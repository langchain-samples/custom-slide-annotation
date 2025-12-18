import { useState, useRef, useEffect, Fragment } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Heading,
  Badge,
  Spinner,
  IconButton,
} from "@chakra-ui/react";
import { HiArrowLeft, HiPaperAirplane } from "react-icons/hi";

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

interface AIMessage {
  content?: string;      // Text response
  toolCalls?: string[];  // Tool names being called
}

interface ConversationalTurn {
  role: "human" | "agent";
  humanMessage?: string;        // User's request
  systemMessage?: string;       // Agent's system prompt (optional)
  aiMessages?: AIMessage[];     // All AI responses
  toolCalls?: TraceRun[];       // Tool execution details
  downloadLink?: string;        // PDF download
  timestamp: string;
  runs: TraceRun[];
  isFromTrace?: boolean;
}

interface ChatPlaygroundProps {
  trace: TraceSlide;
  onBack: () => void;
}

export default function ChatPlayground({ trace, onBack }: ChatPlaygroundProps) {
  const [turns, setTurns] = useState<ConversationalTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleTurn = (idx: number) => {
    setExpandedTurns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  // Parse trace runs into conversational turns
  const parseTraceIntoTurns = (runs: TraceRun[]): ConversationalTurn[] => {
    const turns: ConversationalTurn[] = [];
    
    console.log('===== PARSING TRACE =====');
    console.log('Total runs:', runs.length);
    
    // Sort runs chronologically
    const sorted = [...runs].sort((a, b) => 
      a.start_time.localeCompare(b.start_time)
    );
    
    // Find the last LLM run - it has all messages in chronological order
    const llmRuns = sorted.filter(r => r.run_type === 'llm');
    const lastLLMRun = llmRuns[llmRuns.length - 1];
    
    if (!lastLLMRun?.inputs_summary) {
      console.error("No LLM run found with inputs_summary");
      return turns;
    }
    
    console.log('Last LLM run:', lastLLMRun.run_id);
    console.log('Inputs summary:', lastLLMRun.inputs_summary);
    
    try {
      const inputs = JSON.parse(lastLLMRun.inputs_summary);
      const messages = inputs.messages || [];
      
      console.log('Messages array:', messages);
      
      for (const msgWrapper of messages) {
        // msgWrapper is an array of message objects
        const msgs = Array.isArray(msgWrapper) ? msgWrapper : [msgWrapper];
        
        for (const msg of msgs) {
          // Get message type from id array or type field
          const msgType = msg.id?.[msg.id.length - 1] || msg.type || '';
          const content = msg.kwargs?.content || msg.content || '';
          
          console.log('Message type:', msgType, 'Content preview:', content?.substring(0, 50));
          
          if (msgType === 'SystemMessage') {
            // Show system message
            if (content) {
              turns.push({
                role: "agent",
                systemMessage: content,
                timestamp: lastLLMRun.start_time,
                runs: [],
                isFromTrace: true,
              });
            }
            
          } else if (msgType === 'HumanMessage') {
            // User message
            let humanContent = content;
            humanContent = humanContent.split('\n\nData:\n')[0];
            
            if (humanContent) {
              turns.push({
                role: "human",
                humanMessage: humanContent,
                timestamp: lastLLMRun.start_time,
                runs: [],
                isFromTrace: true,
              });
            }
            
          } else if (msgType === 'AIMessage') {
            // AI response
            const textContent = content;
            const toolCalls = msg.kwargs?.tool_calls || [];
            
            if (textContent || toolCalls.length > 0) {
              const aiMsg: AIMessage = {};
              
              if (textContent) aiMsg.content = textContent;
              if (toolCalls.length > 0) {
                aiMsg.toolCalls = toolCalls.map((tc: any) => 
                  tc.name || tc.function?.name || 'unknown'
                );
              }
              
              turns.push({
                role: "agent",
                aiMessages: [aiMsg],
                timestamp: lastLLMRun.start_time,
                runs: [],
                isFromTrace: true,
              });
            }
            
          } else if (msgType === 'ToolMessage') {
            // Tool execution result
            const toolName = msg.name || msg.kwargs?.name || 'unknown';
            const toolRun = sorted.find(r => r.run_type === 'tool' && r.name === toolName);
            
            const turn: ConversationalTurn = {
              role: "agent",
              toolCalls: toolRun ? [toolRun] : [],
              timestamp: lastLLMRun.start_time,
              runs: toolRun ? [toolRun] : [],
              isFromTrace: true,
            };
            
            if (toolName === 'finalize_presentation') {
              turn.downloadLink = `/api/traces/${trace.trace_id}/slides.pdf`;
            }
            
            turns.push(turn);
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse messages:", e);
    }
    
    // Check for finalize_presentation and add download link
    const finalizeRun = sorted.find(r => r.run_type === 'tool' && r.name === 'finalize_presentation');
    if (finalizeRun) {
      turns.push({
        role: "agent",
        downloadLink: `/api/traces/${trace.trace_id}/slides.pdf`,
        timestamp: finalizeRun.end_time || finalizeRun.start_time,
        runs: [finalizeRun],
        isFromTrace: true,
      });
    }
    
    console.log('Final turns:', turns);
    return turns;
  };

  useEffect(() => {
    // Parse trace runs into conversational turns
    const traceTurns = parseTraceIntoTurns(trace.runs);
    setTurns(traceTurns);
  }, [trace]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userTurn: ConversationalTurn = {
      role: "human",
      humanMessage: input,
      timestamp: new Date().toISOString(),
      runs: [],
      isFromTrace: false,
    };

    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trace_id: trace.trace_id,
          message: input,
          history: [],
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const data = await response.json();

      const assistantTurn: ConversationalTurn = {
        role: "agent",
        aiMessages: [{ content: data.response }],
        timestamp: new Date().toISOString(),
        runs: [],
        isFromTrace: false,
      };

      setTurns((prev) => [...prev, assistantTurn]);
    } catch (error) {
      const errorTurn: ConversationalTurn = {
        role: "agent",
        aiMessages: [{ content: "Sorry, there was an error processing your message. Please try again." }],
        timestamp: new Date().toISOString(),
        runs: [],
        isFromTrace: false,
      };
      setTurns((prev) => [...prev, errorTurn]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box h="100vh" bg="slate.50" display="flex" flexDirection="column">
      {/* Header */}
      <Box
        bg="white"
        borderBottomWidth="1px"
        borderColor="slate.200"
        shadow="subtle"
        p={4}
      >
        <HStack justify="space-between">
          <HStack gap={3}>
            <IconButton
              aria-label="Back to annotation"
              size="sm"
              variant="ghost"
              onClick={onBack}
            >
              <HiArrowLeft />
            </IconButton>
            <VStack align="start" gap={0}>
              <Heading size="md" fontWeight="700">
                Agent Playground
              </Heading>
              <Text fontSize="sm" color="slate.500">
                {trace.trace_name}
              </Text>
            </VStack>
          </HStack>
          <Badge colorScheme="purple" px={3} py={1} borderRadius="full">
            Trace: {trace.trace_id.slice(0, 8)}...
          </Badge>
        </HStack>
      </Box>

      {/* Messages */}
      <Box flex="1" overflowY="auto" p={6} bg="slate.50">
        <VStack gap={6} align="stretch" maxW="900px" mx="auto">
          {turns.map((turn, idx) => {
            const isExpanded = expandedTurns.has(idx);
            const isLastTraceTurn = turn.isFromTrace && 
              (idx === turns.length - 1 || !turns[idx + 1]?.isFromTrace);
            
            // Determine message type and preview
            let messageType = "";
            let preview = "";
            
            if (turn.systemMessage) {
              messageType = "SystemMessage";
              preview = turn.systemMessage.substring(0, 200).replace(/\n/g, " ");
              if (turn.systemMessage.length > 200) preview += "...";
            } else if (turn.humanMessage) {
              messageType = "HumanMessage";
              preview = turn.humanMessage.substring(0, 200).replace(/\n/g, " ");
              if (turn.humanMessage.length > 200) preview += "...";
            } else if (turn.aiMessages && turn.aiMessages.length > 0) {
              messageType = "AIMessage";
              const aiMsg = turn.aiMessages[0];
              if (aiMsg.toolCalls && aiMsg.toolCalls.length > 0) {
                preview = `Calling: ${aiMsg.toolCalls.join(", ")}`;
              } else if (aiMsg.content) {
                preview = aiMsg.content.substring(0, 200).replace(/\n/g, " ");
                if (aiMsg.content.length > 200) preview += "...";
              }
            } else if (turn.downloadLink) {
              messageType = "PresentationOutput";
              preview = "Presentation ready for download";
            } else if (turn.toolCalls && turn.toolCalls.length > 0) {
              messageType = "ToolMessage";
              const tool = turn.toolCalls[0];
              preview = `Executed: ${tool.name}`;
            }
            
            return (
              <Fragment key={idx}>
                <Box w="full">
                  <HStack
                    justify={turn.role === "human" ? "flex-end" : "flex-start"}
                    w="full"
                  >
                    <Box 
                      maxW="85%"
                      w="full"
                      bg="white"
                      borderWidth="1px"
                      borderColor="slate.200"
                      borderRadius="xl"
                      shadow="sm"
                      overflow="hidden"
                      transition="all 0.2s"
                      _hover={{ shadow: "md", borderColor: "slate.300" }}
                    >
                      {/* Header */}
                      <HStack
                        px={4}
                        py={3}
                        bg="slate.50"
                        borderBottomWidth="1px"
                        borderColor="slate.200"
                        justify="space-between"
                        cursor="pointer"
                        onClick={() => toggleTurn(idx)}
                        _hover={{ bg: "slate.100" }}
                      >
                        <HStack gap={3} flex={1}>
                          <VStack align="start" gap={0} flex={1}>
                            <HStack gap={2}>
                              <Badge 
                                colorScheme={
                                  messageType === "SystemMessage" ? "purple" :
                                  messageType === "HumanMessage" ? "blue" :
                                  messageType === "AIMessage" ? "green" :
                                  messageType === "PresentationOutput" ? "green" : "orange"
                                }
                                fontSize="xs"
                                fontWeight="600"
                              >
                                {messageType}
                              </Badge>
                              <Text fontSize="xs" color="slate.500" fontWeight="500">
                                Turn {idx + 1}
                              </Text>
                            </HStack>
                            {!isExpanded && preview && (
                              <Text 
                                fontSize="sm" 
                                color="slate.600" 
                                overflow="hidden"
                                textOverflow="ellipsis"
                                whiteSpace="nowrap"
                                maxW="100%"
                              >
                                {preview}
                              </Text>
                            )}
                          </VStack>
                        </HStack>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTurn(idx);
                          }}
                          minW="auto"
                          px={2}
                        >
                          {isExpanded ? "▼" : "▶"}
                        </Button>
                      </HStack>
                      
                      {/* Expanded content */}
                      {isExpanded && (
                        <Box px={4} py={3}>
                          <VStack align="stretch" gap={3}>
                            {/* System message */}
                            {turn.systemMessage && (
                              <Box>
                                <Text fontSize="xs" fontWeight="600" color="purple.600" mb={2}>
                                  System Instructions:
                                </Text>
                                <Box
                                  bg="purple.50"
                                  p={3}
                                  borderRadius="md"
                                  borderLeftWidth="3px"
                                  borderColor="purple.300"
                                >
                                  <Text fontSize="xs" whiteSpace="pre-wrap" color="slate.700" lineHeight="1.6">
                                    {turn.systemMessage}
                                  </Text>
                                </Box>
                              </Box>
                            )}
                            
                            {/* Human message */}
                            {turn.humanMessage && (
                              <Box>
                                <Text fontSize="xs" fontWeight="600" color="blue.600" mb={2}>
                                  Message:
                                </Text>
                                <Box
                                  bg="blue.50"
                                  p={3}
                                  borderRadius="md"
                                  borderLeftWidth="3px"
                                  borderColor="blue.300"
                                >
                                  <Text fontSize="sm" whiteSpace="pre-wrap" color="slate.700" lineHeight="1.6">
                                    {turn.humanMessage}
                                  </Text>
                                </Box>
                              </Box>
                            )}
                            
                            {/* AI messages */}
                            {turn.aiMessages?.map((aiMsg, i) => (
                              <Box key={i}>
                                {aiMsg.content && (
                                  <Box>
                                    <Text fontSize="xs" fontWeight="600" color="green.600" mb={2}>
                                      AI Response:
                                    </Text>
                                    <Box
                                      bg="green.50"
                                      p={3}
                                      borderRadius="md"
                                      borderLeftWidth="3px"
                                      borderColor="green.300"
                                    >
                                      <Text fontSize="sm" color="slate.700" lineHeight="1.6">
                                        {aiMsg.content}
                                      </Text>
                                    </Box>
                                  </Box>
                                )}
                                {aiMsg.toolCalls && aiMsg.toolCalls.length > 0 && (
                                  <Box>
                                    <Text fontSize="xs" fontWeight="600" color="blue.600" mb={2}>
                                      Tool Calls:
                                    </Text>
                                    <VStack align="stretch" gap={2}>
                                      {aiMsg.toolCalls.map((toolName, j) => (
                                        <Box 
                                          key={j}
                                          bg="blue.50"
                                          p={3}
                                          borderRadius="md"
                                          borderWidth="1px"
                                          borderColor="blue.200"
                                        >
                                          <HStack gap={2}>
                                            <Text fontSize="sm" fontWeight="600" fontFamily="mono">
                                              {toolName}
                                            </Text>
                                          </HStack>
                                        </Box>
                                      ))}
                                    </VStack>
                                  </Box>
                                )}
                              </Box>
                            ))}
                            
                            {/* Tool execution */}
                            {turn.toolCalls && turn.toolCalls.length > 0 && (
                              <Box>
                                <Text fontSize="xs" fontWeight="600" color="orange.600" mb={2}>
                                  Tool Execution:
                                </Text>
                                <VStack align="stretch" gap={2}>
                                  {turn.toolCalls.map((tool, i) => {
                                    console.log('Rendering tool:', {
                                      name: tool.name,
                                      duration: tool.duration_ms,
                                      hasInputs: !!tool.inputs_summary,
                                      hasOutputs: !!tool.outputs_summary,
                                      inputsSummary: tool.inputs_summary,
                                      outputsSummary: tool.outputs_summary,
                                    });
                                    
                                    // Parse tool inputs
                                    let toolInputs = "";
                                    try {
                                      if (tool.inputs_summary) {
                                        const inputs = JSON.parse(tool.inputs_summary);
                                        if (inputs.input) {
                                          // Handle single-quoted Python dict
                                          const cleanInput = typeof inputs.input === 'string' 
                                            ? inputs.input.replace(/'/g, '"')
                                            : JSON.stringify(inputs.input);
                                          try {
                                            const parsed = JSON.parse(cleanInput);
                                            toolInputs = JSON.stringify(parsed, null, 2);
                                          } catch {
                                            toolInputs = inputs.input;
                                          }
                                        } else {
                                          toolInputs = JSON.stringify(inputs, null, 2);
                                        }
                                      }
                                    } catch (e) {
                                      console.error('Failed to parse inputs:', e);
                                      toolInputs = tool.inputs_summary || "{}";
                                    }
                                    
                                    // Parse tool output
                                    let toolOutput = "";
                                    try {
                                      if (tool.outputs_summary) {
                                        const outputs = JSON.parse(tool.outputs_summary);
                                        if (outputs.output?.content) {
                                          toolOutput = outputs.output.content;
                                        } else if (outputs.output) {
                                          toolOutput = JSON.stringify(outputs.output, null, 2);
                                        } else {
                                          toolOutput = JSON.stringify(outputs, null, 2);
                                        }
                                      }
                                    } catch (e) {
                                      console.error('Failed to parse outputs:', e);
                                      toolOutput = tool.outputs_summary || "{}";
                                    }
                                    
                                    return (
                                      <Box 
                                        key={i}
                                        bg="orange.50"
                                        p={3}
                                        borderRadius="md"
                                        borderWidth="1px"
                                        borderColor="orange.200"
                                      >
                                        <HStack gap={2} mb={2}>
                                          <Text fontSize="sm" fontWeight="600" fontFamily="mono" color="slate.700">
                                            {tool.name}
                                          </Text>
                                          {tool.duration_ms !== undefined && (
                                            <Badge fontSize="xs" colorScheme="gray">
                                              {tool.duration_ms}ms
                                            </Badge>
                                          )}
                                        </HStack>
                                        
                                        <VStack align="stretch" gap={2}>
                                          {/* Inputs */}
                                          <Box
                                            p={2}
                                            bg="white"
                                            borderRadius="sm"
                                            maxH="200px"
                                            overflowY="auto"
                                          >
                                            <Text fontWeight="600" fontSize="xs" mb={1} color="slate.600">
                                              Inputs:
                                            </Text>
                                            <Box 
                                              as="pre" 
                                              fontSize="xs" 
                                              color="slate.700"
                                              whiteSpace="pre-wrap"
                                              wordBreak="break-word"
                                            >
                                              {toolInputs}
                                            </Box>
                                          </Box>
                                          
                                          {/* Outputs */}
                                          <Box
                                            p={2}
                                            bg="white"
                                            borderRadius="sm"
                                            maxH="200px"
                                            overflowY="auto"
                                          >
                                            <Text fontWeight="600" fontSize="xs" mb={1} color="slate.600">
                                              Output:
                                            </Text>
                                            <Box 
                                              as="pre" 
                                              fontSize="xs" 
                                              color="slate.700"
                                              whiteSpace="pre-wrap"
                                              wordBreak="break-word"
                                            >
                                              {toolOutput}
                                            </Box>
                                          </Box>
                                        </VStack>
                                      </Box>
                                    );
                                  })}
                                </VStack>
                              </Box>
                            )}
                            
                            {/* Download link */}
                            {turn.downloadLink && (
                              <Box bg="green.50" p={3} borderRadius="md" borderWidth="1px" borderColor="green.200">
                                <VStack align="start" gap={2}>
                                  <Text fontSize="sm" fontWeight="600" color="green.700">
                                    Presentation Ready
                                  </Text>
                                  <a href={turn.downloadLink} download>
                                    <Button size="sm" colorScheme="green">
                                      Download PDF
                                    </Button>
                                  </a>
                                </VStack>
                              </Box>
                            )}
                          </VStack>
                        </Box>
                      )}
                    </Box>
                  </HStack>
                </Box>
                
                {/* Separator after trace history */}
                {isLastTraceTurn && (
                  <Box my={6} position="relative">
                    <Box borderTopWidth="2px" borderColor="brand.200" />
                    <Badge
                      position="absolute"
                      top="50%"
                      left="50%"
                      transform="translate(-50%, -50%)"
                      colorScheme="blue"
                      bg="slate.50"
                      px={4}
                      py={2}
                      fontSize="sm"
                      fontWeight="600"
                      shadow="sm"
                    >
                      Continue Conversation
                    </Badge>
                  </Box>
                )}
              </Fragment>
            );
          })}
          
          {loading && (
            <HStack justify="flex-start" w="full" align="start">
              <Box maxW="80%">
                <Text fontSize="xs" color="slate.500" mb={1}>
                  🤖 Agent • {new Date().toLocaleTimeString()}
                </Text>
                <Box
                  bg="white"
                  borderWidth="1px"
                  borderColor="slate.200"
                  px={4}
                  py={3}
                  borderRadius="2xl"
                  borderBottomLeftRadius="md"
                  shadow="md"
                >
                  <HStack gap={2}>
                    <Spinner size="sm" color="brand.500" />
                    <Text fontSize="sm" color="slate.500">
                      Thinking...
                    </Text>
                  </HStack>
                </Box>
              </Box>
            </HStack>
          )}
          
          <div ref={messagesEndRef} />
        </VStack>
      </Box>

      {/* Input */}
      <Box
        bg="white"
        borderTopWidth="1px"
        borderColor="slate.200"
        p={4}
        shadow="elevated"
      >
        <HStack maxW="900px" mx="auto" gap={2}>
          <Input
            placeholder="Ask the agent to modify slides, explain decisions, or regenerate..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            size="lg"
            borderRadius="xl"
          />
          <Button
            colorScheme="brand"
            size="lg"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            borderRadius="xl"
            px={6}
          >
            <HiPaperAirplane />
          </Button>
        </HStack>
      </Box>
    </Box>
  );
}

