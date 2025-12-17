import { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
} from "@chakra-ui/react";
import { HiCheckCircle, HiXCircle, HiClock, HiChevronDown, HiChevronRight } from "react-icons/hi";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

interface TraceStepsPanelProps {
  runs: TraceRun[];
}

export default function TraceStepsPanel({ runs }: TraceStepsPanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (runId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedSteps(newExpanded);
  };

  const formatJson = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "success") {
      return <HiCheckCircle color="green" size={20} />;
    } else if (status === "error") {
      return <HiXCircle color="red" size={20} />;
    }
    return <HiClock color="gray" size={20} />;
  };

  const getStatusColor = (status: string) => {
    if (status === "success") return "green";
    if (status === "error") return "red";
    return "gray";
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getRunTypeColor = (runType: string) => {
    switch (runType) {
      case "llm": return "purple";
      case "tool": return "blue";
      case "chain": return "cyan";
      case "retriever": return "teal";
      default: return "gray";
    }
  };

  if (runs.length === 0) {
    return (
      <Box p={6} textAlign="center">
        <Text color="slate.500" fontWeight="500">No trace steps available</Text>
      </Box>
    );
  }

  return (
    <Box h="full" overflowY="auto" p={4}>
      <Text fontSize="xs" fontWeight="700" color="slate.500" mb={4} textTransform="uppercase" letterSpacing="wider">
        Trace Steps ({runs.length})
      </Text>
      
      <VStack gap={2} align="stretch">
        {runs.map((run) => {
          const isExpanded = expandedSteps.has(run.run_id);
          
          return (
            <Box
              key={run.run_id}
              borderWidth="1px"
              borderColor="slate.200"
              borderRadius="xl"
              bg="white"
              shadow="subtle"
              _hover={{ shadow: "premium", borderColor: "brand.300" }}
              transition="all 0.2s"
            >
              <Box
                p={3}
                cursor="pointer"
                onClick={() => toggleStep(run.run_id)}
                _hover={{ bg: "slate.50" }}
                borderRadius="xl"
                transition="all 0.15s"
              >
                <HStack align="center" gap={2}>
                  <Box color="slate.500">
                    {isExpanded ? <HiChevronDown size={18} /> : <HiChevronRight size={18} />}
                  </Box>
                  {getStatusIcon(run.status)}
                  <VStack align="start" gap={0} flex="1">
                    <HStack>
                      <Text fontWeight="600" fontSize="sm" color="slate.900">
                        {run.name}
                      </Text>
                      <Badge colorScheme={getRunTypeColor(run.run_type)} fontSize="xs" borderRadius="full" px={2} py={0.5}>
                        {run.run_type}
                      </Badge>
                    </HStack>
                    <HStack gap={3} fontSize="xs" color="slate.600">
                      <Text fontWeight="500">Duration: {formatDuration(run.duration_ms)}</Text>
                      <Badge colorScheme={getStatusColor(run.status)} fontSize="xs">
                        {run.status}
                      </Badge>
                    </HStack>
                  </VStack>
                </HStack>
              </Box>
              
              {isExpanded && (
                <Box pb={4} pt={2} px={3} bg="slate.50" borderTop="1px" borderColor="slate.200" borderBottomRadius="xl">
                  <VStack align="stretch" gap={3}>
                    {run.inputs_summary && (
                      <Box>
                        <Text fontSize="xs" fontWeight="700" color="slate.700" mb={2}>
                          Inputs:
                        </Text>
                        <Box
                          borderRadius="lg"
                          maxH="200px"
                          overflowY="auto"
                          borderWidth="1px"
                          borderColor="slate.200"
                        >
                          <SyntaxHighlighter 
                            language="json" 
                            style={vscDarkPlus} 
                            customStyle={{fontSize: '11px', margin: 0, maxHeight: '200px', borderRadius: '0.5rem'}}
                          >
                            {formatJson(run.inputs_summary)}
                          </SyntaxHighlighter>
                        </Box>
                      </Box>
                    )}
                    
                    {run.outputs_summary && (
                      <Box>
                        <Text fontSize="xs" fontWeight="700" color="slate.700" mb={2}>
                          Outputs:
                        </Text>
                        <Box
                          borderRadius="lg"
                          maxH="200px"
                          overflowY="auto"
                          borderWidth="1px"
                          borderColor="slate.200"
                        >
                          <SyntaxHighlighter 
                            language="json" 
                            style={vscDarkPlus} 
                            customStyle={{fontSize: '11px', margin: 0, maxHeight: '200px', borderRadius: '0.5rem'}}
                          >
                            {formatJson(run.outputs_summary)}
                          </SyntaxHighlighter>
                        </Box>
                      </Box>
                    )}
                    
                    {run.error && (
                      <Box>
                        <Text fontSize="xs" fontWeight="700" color="red.700" mb={2}>
                          Error:
                        </Text>
                        <Box
                          p={3}
                          bg="red.50"
                          borderRadius="lg"
                          fontSize="xs"
                          color="red.700"
                          fontWeight="500"
                          borderWidth="1px"
                          borderColor="red.200"
                        >
                          {run.error}
                        </Box>
                      </Box>
                    )}
                    
                    <HStack fontSize="xs" color="slate.500" gap={4} fontFamily="mono">
                      <Text>Run ID: {run.run_id.slice(0, 8)}...</Text>
                      {run.parent_run_id && (
                        <Text>Parent: {run.parent_run_id.slice(0, 8)}...</Text>
                      )}
                    </HStack>
                  </VStack>
                </Box>
              )}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
