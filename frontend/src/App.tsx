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
import { HiRefresh } from "react-icons/hi";
import SlidePdfViewer from "./SlidePdfViewer";
import TraceStepsPanel from "./TraceStepsPanel";
import FeedbackPanel from "./FeedbackPanel";
import TraceMetadataPanel from "./TraceMetadataPanel";
import ChatPlayground from "./ChatPlayground";

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
  project_name: string;
}

function App() {
  const [traces, setTraces] = useState<TraceSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<TraceSlide | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [projectName, setProjectName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"annotation" | "chat">("annotation");

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
      setProjectName(data.project_name);
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

  const openTraceInChat = () => {
    setViewMode("chat");
  };

  const closeChat = () => {
    setViewMode("annotation");
  };

  // Render chat view if in chat mode
  if (viewMode === "chat" && selectedTrace) {
    return (
      <ChatPlayground
        trace={selectedTrace}
        onBack={closeChat}
      />
    );
  }

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="slate.50">
        <VStack gap={4}>
          <Spinner size="xl" color="brand.500" borderWidth="4px" />
          <Text color="slate.600" fontWeight="500">Loading traces from LangSmith...</Text>
        </VStack>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg="slate.50">
        <Card.Root maxW="md" shadow="premium" borderRadius="2xl" borderWidth="1px" borderColor="slate.200">
          <Card.Body p={8}>
            <VStack gap={6}>
              <Box bg="red.50" p={6} borderRadius="xl" borderWidth="2px" borderColor="red.300" w="full">
                <Heading size="lg" color="red.700" mb={3} fontWeight="bold">Error</Heading>
                <Text color="red.600" fontSize="md">{error}</Text>
              </Box>
              <Button 
                colorScheme="brand" 
                size="lg"
                w="full"
                shadow="premium"
                borderRadius="xl"
                fontWeight="600"
                _hover={{ shadow: "elevated", transform: "translateY(-1px)" }}
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
    <Box minH="100vh" bg="slate.50">
      <Box 
        bg="white" 
        borderBottomWidth="1px" 
        borderColor="slate.200"
        shadow="subtle"
        position="sticky"
        top="0"
        zIndex="10"
      >
        <Container maxW="full" px={8}>
          <Flex h="72px" align="center" justify="space-between">
            {/* Left: Title + Project Badge */}
            <HStack gap={4} align="center">
              <Heading 
                size="2xl" 
                fontWeight="700" 
                bgGradient="to-r"
                gradientFrom="brand.600"
                gradientTo="brand.800"
                bgClip="text"
                letterSpacing="-0.02em"
              >
                Annotation Queue
              </Heading>
              <Badge
                colorScheme="blue"
                px={4}
                py={2}
                borderRadius="full"
                fontSize="sm"
                fontWeight="600"
                shadow="subtle"
              >
                {projectName || "LangSmith Project"}
              </Badge>
            </HStack>

            {/* Right: Refresh Button */}
            <Button
              size="lg"
              colorScheme="brand"
              borderRadius="xl"
              shadow="premium"
              px={6}
              fontWeight="600"
              _hover={{ shadow: "elevated", transform: "translateY(-2px)" }}
              transition="all 0.2s"
              onClick={fetchTraces}
              disabled={loading}
            >
              <HiRefresh style={{ marginRight: '8px' }} />
              Refresh Traces
            </Button>
          </Flex>
        </Container>
      </Box>

      <Flex h="calc(100vh - 72px)">
        {/* Sidebar - Trace Cards */}
        <Box 
          w="300px" 
          bg="slate.50" 
          borderRightWidth="1px" 
          borderColor="slate.200" 
          overflowY="auto" 
          p={4}
        >
          <Text 
            fontSize="xs" 
            fontWeight="700" 
            color="slate.500" 
            mb={4} 
            textTransform="uppercase" 
            letterSpacing="wider"
          >
            Recent Traces
          </Text>
          <VStack gap={3} align="stretch">
            {traces.map((trace) => (
              <Card.Root
                key={trace.trace_id}
                cursor="pointer"
                onClick={() => setSelectedTrace(trace)}
                bg="white"
                borderWidth="2px"
                borderColor={selectedTrace?.trace_id === trace.trace_id ? "brand.500" : "slate.200"}
                borderRadius="xl"
                shadow={selectedTrace?.trace_id === trace.trace_id ? "premium" : "subtle"}
                _hover={{ 
                  shadow: "premium", 
                  borderColor: "brand.400",
                  transform: "translateX(4px)" 
                }}
                transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <Card.Body p={4}>
                  <VStack align="stretch" gap={3}>
                    <Text 
                      fontWeight="700" 
                      fontSize="sm" 
                      color={selectedTrace?.trace_id === trace.trace_id ? "brand.900" : "slate.900"}
                      lineHeight="1.4"
                    >
                      {trace.trace_name}
                    </Text>
                    <Text fontSize="xs" color="slate.500" fontWeight="500">
                      {formatDate(trace.created_at)}
                    </Text>
                    <HStack gap={2} flexWrap="wrap">
                      {trace.has_pdf && <Badge colorScheme="green" fontSize="xs" borderRadius="full" px={2} py={1}>PDF</Badge>}
                      {trace.conversion_failed && <Badge colorScheme="red" fontSize="xs" borderRadius="full" px={2} py={1}>Failed</Badge>}
                      {trace.pptx_base64 && !trace.has_pdf && !trace.conversion_failed && (
                        <Badge colorScheme="orange" fontSize="xs" borderRadius="full" px={2} py={1}>PPTX Only</Badge>
                      )}
                      {!trace.pptx_base64 && trace.error && (
                        <Badge colorScheme="red" fontSize="xs" borderRadius="full" px={2} py={1}>No PPTX</Badge>
                      )}
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        </Box>

        {/* Steps Panel - Accordion */}
        <Box w="350px" bg="white" borderRightWidth="1px" borderColor="slate.200" overflowY="auto">
          {selectedTrace ? (
            <TraceStepsPanel runs={selectedTrace.runs} />
          ) : (
            <Box p={6} textAlign="center">
              <Text color="slate.500" fontWeight="500">Select a trace to view steps</Text>
            </Box>
          )}
        </Box>

        {/* Main Viewer */}
        <Box flex="1" p={6} bg="slate.50">
          {selectedTrace ? (
            <VStack gap={4} h="full" align="stretch">
              {/* NEW: Metadata Panel */}
              <TraceMetadataPanel
                traceId={selectedTrace.trace_id}
                traceName={selectedTrace.trace_name}
                projectName={projectName}
                langsmithUrl={selectedTrace.langsmith_url}
                createdAt={selectedTrace.created_at}
                onOpenChat={openTraceInChat}
              />

              {/* PDF Viewer Card */}
              <Card.Root 
                flex="1" 
                shadow="premium" 
                bg="white" 
                borderRadius="2xl" 
                borderWidth="1px" 
                borderColor="slate.200"
                overflow="hidden"
              >
                <Card.Body p={0} h="full">
                  {selectedTrace.has_pdf ? (
                    <SlidePdfViewer 
                      pdfUrl={`/api/traces/${selectedTrace.trace_id}/slides.pdf`}
                      onPageChange={setCurrentSlide}
                      onNumPagesChange={setNumPages}
                    />
                  ) : selectedTrace.conversion_failed ? (
                    <Flex align="center" justify="center" h="full">
                      <Box bg="red.50" p={8} borderRadius="2xl" borderWidth="2px" borderColor="red.300" maxW="md" shadow="premium">
                        <Heading size="md" color="red.700" mb={3} fontWeight="700">Conversion Failed</Heading>
                        <Text color="red.600" fontSize="sm">
                          This file may be corrupt or in an unsupported format.
                        </Text>
                      </Box>
                    </Flex>
                  ) : selectedTrace.pptx_base64 ? (
                    <Flex align="center" justify="center" h="full">
                      <Box bg="orange.50" p={8} borderRadius="2xl" borderWidth="2px" borderColor="orange.300" maxW="md" shadow="premium">
                        <Heading size="md" color="orange.700" mb={3} fontWeight="700">PDF Conversion Not Available</Heading>
                        <Text color="orange.700" fontSize="sm">
                          LibreOffice is not installed. You can download the PPTX file from the feedback panel.
                        </Text>
                      </Box>
                    </Flex>
                  ) : (
                    <Flex align="center" justify="center" h="full">
                      <Box bg="red.50" p={8} borderRadius="2xl" borderWidth="2px" borderColor="red.300" maxW="md" shadow="premium">
                        <Heading size="md" color="red.700" mb={3} fontWeight="700">No Presentation Found</Heading>
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
                <Heading size="xl" color="brand.600" fontWeight="700">
                  Select a trace
                </Heading>
                <Text color="slate.600" fontSize="lg" fontWeight="500">Choose a trace from the sidebar to view its presentation</Text>
              </VStack>
            </Flex>
          )}
        </Box>

        {/* Feedback Panel - 4th Column */}
        <Box w="320px" bg="white" borderLeftWidth="1px" borderColor="slate.200" p={4} overflowY="auto">
          {selectedTrace ? (
            <FeedbackPanel
              trace={selectedTrace}
              currentSlide={currentSlide}
              totalSlides={numPages}
              onDownload={() =>
                downloadPptx(selectedTrace.pptx_base64!, `${selectedTrace.trace_name}.pptx`)
              }
            />
          ) : (
            <Box p={6} textAlign="center">
              <Text color="slate.500" fontWeight="500">Select a trace to provide feedback</Text>
            </Box>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

export default App;
