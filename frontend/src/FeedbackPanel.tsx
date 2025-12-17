import { useState } from "react";
import {
  Box,
  VStack,
  Heading,
  Button,
  Textarea,
  createToaster,
} from "@chakra-ui/react";
import { HiDownload } from "react-icons/hi";

const toaster = createToaster({
  placement: "top-end",
  pauseOnPageIdle: true,
});

interface TraceSlide {
  trace_id: string;
  trace_name: string;
  created_at: string;
  pptx_base64?: string;
  has_pdf: boolean;
  conversion_failed: boolean;
  error?: string;
  langsmith_url?: string;
}

interface FeedbackPanelProps {
  trace: TraceSlide;
  currentSlide: number;
  totalSlides: number;
  onDownload: () => void;
}

export default function FeedbackPanel({ trace, currentSlide, totalSlides, onDownload }: FeedbackPanelProps) {
  const [traceFeedback, setTraceFeedback] = useState("");
  const [slideFeedback, setSlideFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const submitTraceFeedback = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trace_id: trace.trace_id,
          feedback_type: "trace",
          content: traceFeedback,
        }),
      });
      
      if (response.ok) {
        toaster.success({
          title: "Feedback submitted",
          description: "Your trace feedback has been recorded.",
        });
        setTraceFeedback("");
      } else {
        throw new Error("Failed to submit feedback");
      }
    } catch (error) {
      toaster.error({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const submitSlideFeedback = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trace_id: trace.trace_id,
          feedback_type: "slide",
          slide_number: currentSlide,
          content: slideFeedback,
        }),
      });
      
      if (response.ok) {
        toaster.success({
          title: "Feedback submitted",
          description: `Your feedback for slide ${currentSlide} has been recorded.`,
        });
        setSlideFeedback("");
      } else {
        throw new Error("Failed to submit feedback");
      }
    } catch (error) {
      toaster.error({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <VStack gap={6} align="stretch">
      {/* Download Button */}
      {trace.pptx_base64 && (
        <Button
          colorScheme="cyan"
          size="lg"
          shadow="lg"
          borderRadius="xl"
          _hover={{ shadow: "xl", transform: "translateY(-2px)" }}
          onClick={onDownload}
        >
          <HiDownload style={{ marginRight: '8px' }} />
          Download PPTX Artifact
        </Button>
      )}
      
      {/* Trace Feedback */}
      <Box>
        <Heading size="sm" mb={3} color="gray.700">💬 Trace Feedback</Heading>
        <Textarea
          placeholder="Overall feedback about this trace..."
          value={traceFeedback}
          onChange={(e) => setTraceFeedback(e.target.value)}
          rows={4}
          borderColor="blue.200"
          _hover={{ borderColor: "blue.300" }}
          _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
        />
        <Button
          mt={2}
          colorScheme="blue"
          size="sm"
          w="full"
          onClick={submitTraceFeedback}
          loading={submitting}
          disabled={!traceFeedback.trim()}
        >
          Submit Trace Feedback
        </Button>
      </Box>
      
      {/* Slide-Specific Feedback */}
      {totalSlides > 0 && (
        <Box>
          <Heading size="sm" mb={3} color="gray.700">📝 Slide {currentSlide} Feedback</Heading>
          <Textarea
            placeholder={`Feedback about slide ${currentSlide}...`}
            value={slideFeedback}
            onChange={(e) => setSlideFeedback(e.target.value)}
            rows={4}
            borderColor="blue.200"
            _hover={{ borderColor: "blue.300" }}
            _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
          />
          <Button
            mt={2}
            colorScheme="blue"
            size="sm"
            w="full"
            onClick={submitSlideFeedback}
            loading={submitting}
            disabled={!slideFeedback.trim()}
          >
            Submit Slide Feedback
          </Button>
        </Box>
      )}
    </VStack>
  );
}

