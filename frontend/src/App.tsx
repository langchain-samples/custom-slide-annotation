import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Flex,
  Spinner,
  Badge,
  Card,
} from "@chakra-ui/react";
import { HiRefresh, HiExternalLink } from "react-icons/hi";
import SlidePdfViewer from "./SlidePdfViewer";
import TraceStepsPanel from "./TraceStepsPanel";
import FeedbackPanel from "./FeedbackPanel";

interface TraceRun {
  run_id: string;
  name: string;
  run_type: string;
  status: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  inputs_summary?: string;
  outputs_summary?: string;
  error?: string;
  parent_run_id?: string;
}

interface TraceSlide {
  trace_id: string;
  trace_name: string;
  created_at: string;
  pptx_base64?: string;
  has_pdf: boolean;
  conversion_failed: boolean;
  error?: string;
  runs: TraceRun[];
  langsmith_url?: string;
}

interface TracesResponse {
  traces: TraceSlide[];
}

function App() {
  const [traces, setTraces] = useState<TraceSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<TraceSlide | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);

  useEffect(() => {
    fetchTraces();
  }, []);

  const fetchTraces = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/traces");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: TracesResponse = await response.json();
      setTraces(data.traces);
      if (data.traces.length > 0) {
        setSelectedTrace(data.traces[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch traces");
    } finally {
      setLoading(false);
    }
  };

  const downloadPptx = (pptxBase64: string, filename: string) => {
    const bytes = atob(pptxBase64);
    const arrayBuffer = new ArrayBuffer(bytes.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.length; i++) {
      uint8Array[i] = bytes.charCodeAt(i);
    }

    const blob = new Blob([uint8Array], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="blue.100">
        <VStack gap={4}>
          <Spinner size="xl" color="blue.500" borderWidth="4px" />
          <Text color="gray.600">Loading traces from LangSmith...</Text>
        </VStack>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="blue.100">
        <Card.Root maxW="md" shadow="2xl" borderRadius="2xl" borderWidth="1px" borderColor="red.200">
          <Card.Body p={8}>
            <VStack gap={6}>
              <Box bg="red.50" p={6} borderRadius="xl" borderWidth="2px" borderColor="red.300" w="full">
                <Heading size="lg" color="red.700" mb={3} fontWeight="bold">Error</Heading>
                <Text color="red.600" fontSize="md">{error}</Text>
              </Box>
              <Button 
                colorScheme="blue" 
                size="lg"
                w="full"
                shadow="lg"
                borderRadius="xl"
                _hover={{ shadow: "xl", transform: "translateY(-1px)" }}
                onClick={fetchTraces}
              >
                <HiRefresh style={{ marginRight: '8px' }} />
                Retry
              </Button>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="blue.100">
      <Box bg="white" shadow="lg" borderBottomWidth="2px" borderColor="blue.300">
        <Container maxW="container.xl">
          <Flex h="20" align="center" justify="space-between">
            <Heading 
              size="2xl" 
              fontWeight="bold" 
              bgGradient="to-r" 
              gradientFrom="brand.600" 
              gradientTo="brand.800" 
              bgClip="text"
              letterSpacing="tight"
            >
              Custom Annotation Queue: Backed by LangSmith
            </Heading>
            <Button 
              colorScheme="blue" 
              size="md"
              shadow="lg"
              borderRadius="xl"
              _hover={{ shadow: "xl", transform: "translateY(-1px)" }}
              onClick={fetchTraces}
            >
              <HiRefresh style={{ marginRight: '8px' }} />
              Refresh
            </Button>
          </Flex>
        </Container>
      </Box>

      <Flex h="calc(100vh - 81px)">
        {/* Sidebar - Trace Cards */}
        <Box w="280px" bg="blue.50" borderRightWidth="2px" borderColor="brand.200" overflowY="auto" p={4} shadow="inner">
          <Text fontSize="sm" fontWeight="bold" color="brand.700" mb={4} textTransform="uppercase" letterSpacing="wide">
            Recent Traces
          </Text>
          <VStack gap={3} align="stretch">
            {traces.map((trace) => (
              <Card.Root
                key={trace.trace_id}
                cursor="pointer"
                onClick={() => setSelectedTrace(trace)}
                bg={selectedTrace?.trace_id === trace.trace_id ? "blue.200" : "white"}
                borderWidth="2px"
                borderColor={selectedTrace?.trace_id === trace.trace_id ? "blue.500" : "blue.200"}
                borderRadius="xl"
                shadow={selectedTrace?.trace_id === trace.trace_id ? "xl" : "md"}
                _hover={{ shadow: "xl", borderColor: "blue.400", transform: "translateY(-2px)" }}
                transition="all 0.2s"
              >
                <Card.Body p={4}>
                  <VStack align="stretch" gap={2}>
                    <Text fontWeight="bold" fontSize="sm" color={selectedTrace?.trace_id === trace.trace_id ? "blue.900" : "gray.800"}>
                      {trace.trace_name}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {formatDate(trace.created_at)}
                    </Text>
                    <VStack align="stretch" gap={2}>
                      <HStack gap={2} flexWrap="wrap">
                        {trace.has_pdf && <Badge colorScheme="green" fontSize="xs" borderRadius="full">PDF</Badge>}
                        {trace.conversion_failed && <Badge colorScheme="red" fontSize="xs" borderRadius="full">Failed</Badge>}
                        {trace.pptx_base64 && !trace.has_pdf && !trace.conversion_failed && (
                          <Badge colorScheme="orange" fontSize="xs" borderRadius="full">PPTX Only</Badge>
                        )}
                        {!trace.pptx_base64 && trace.error && (
                          <Badge colorScheme="red" fontSize="xs" borderRadius="full">No PPTX</Badge>
                        )}
                      </HStack>
                      {trace.langsmith_url && (
                        <a
                          href={trace.langsmith_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'none', width: '100%' }}
                        >
                          <Button
                            size="xs"
                            colorScheme="blue"
                            variant="ghost"
                            w="full"
                            justifyContent="flex-start"
                          >
                            <HiExternalLink style={{ marginRight: '4px' }} />
                            View in LangSmith
                          </Button>
                        </a>
                      )}
                    </VStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        </Box>

        {/* Steps Panel - Accordion */}
        <Box w="350px" bg="white" borderRightWidth="2px" borderColor="brand.200" overflowY="auto" shadow="inner">
          {selectedTrace ? (
            <TraceStepsPanel runs={selectedTrace.runs} />
          ) : (
            <Box p={6} textAlign="center">
              <Text color="gray.500">Select a trace to view steps</Text>
            </Box>
          )}
        </Box>

        {/* Main Viewer */}
        <Box flex="1" p={6} bg="blue.50">
          {selectedTrace ? (
            <VStack gap={4} h="full" align="stretch">
              <Heading size="lg" mb={2}>{selectedTrace.trace_name}</Heading>

              <Card.Root flex="1" shadow="2xl" bg="white" borderRadius="2xl" borderWidth="2px" borderColor="blue.200">
                <Card.Body p={0} h="full" borderRadius="2xl" overflow="hidden">
                  {selectedTrace.has_pdf ? (
                    <SlidePdfViewer 
                      pdfUrl={`/api/traces/${selectedTrace.trace_id}/slides.pdf`}
                      onPageChange={setCurrentSlide}
                    />
                  ) : selectedTrace.conversion_failed ? (
                    <Flex align="center" justify="center" h="full">
                      <Box bg="red.50" p={8} borderRadius="2xl" borderWidth="2px" borderColor="red.300" maxW="md" shadow="xl">
                        <Heading size="md" color="red.700" mb={3} fontWeight="bold">Conversion Failed</Heading>
                        <Text color="red.600" fontSize="sm">
                          This file may be corrupt or in an unsupported format.
                        </Text>
                      </Box>
                    </Flex>
                  ) : selectedTrace.pptx_base64 ? (
                    <Flex align="center" justify="center" h="full">
                      <Box bg="orange.50" p={8} borderRadius="2xl" borderWidth="2px" borderColor="orange.300" maxW="md" shadow="xl">
                        <Heading size="md" color="orange.700" mb={3} fontWeight="bold">PDF Conversion Not Available</Heading>
                        <Text color="orange.700" fontSize="sm">
                          LibreOffice is not installed. You can download the PPTX file above.
                        </Text>
                      </Box>
                    </Flex>
                  ) : (
                    <Flex align="center" justify="center" h="full">
                      <Box bg="red.50" p={8} borderRadius="2xl" borderWidth="2px" borderColor="red.300" maxW="md" shadow="xl">
                        <Heading size="md" color="red.700" mb={3} fontWeight="bold">No Presentation Found</Heading>
                        <Text color="red.600" fontSize="sm">
                          {selectedTrace.error || "This trace does not contain PPTX output."}
                        </Text>
                      </Box>
                    </Flex>
                  )}
                </Card.Body>
              </Card.Root>
            </VStack>
          ) : (
            <Flex align="center" justify="center" h="full">
              <VStack gap={4}>
                <Heading size="xl" color="blue.600" fontWeight="bold">
                  Select a trace
                </Heading>
                <Text color="gray.600" fontSize="lg">Choose a trace from the sidebar to view its presentation</Text>
              </VStack>
            </Flex>
          )}
        </Box>

        {/* Feedback Panel - NEW 4th Column */}
        <Box w="320px" bg="white" borderLeftWidth="2px" borderColor="blue.200" p={4} overflowY="auto" shadow="inner">
          {selectedTrace ? (
            <FeedbackPanel
              trace={selectedTrace}
              currentSlide={currentSlide}
              totalSlides={0}
              onDownload={() =>
                downloadPptx(selectedTrace.pptx_base64!, `${selectedTrace.trace_name}.pptx`)
              }
            />
          ) : (
            <Box p={6} textAlign="center">
              <Text color="gray.500">Select a trace to provide feedback</Text>
            </Box>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

export default App;
