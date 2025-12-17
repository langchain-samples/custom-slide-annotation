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
    <VStack gap={6} align="stretch" p={2}>
      {/* Download Button */}
      {trace.pptx_base64 && (
        <Button
          colorScheme="brand"
          size="lg"
          shadow="premium"
          borderRadius="xl"
          fontWeight="600"
          _hover={{ shadow: "elevated", transform: "translateY(-2px)" }}
          transition="all 0.2s"
          onClick={onDownload}
        >
          <HiDownload style={{ marginRight: '8px' }} />
          Download Artifact
        </Button>
      )}
      
      {/* Trace Feedback Section */}
      <Box
        p={5}
        bg="slate.50"
        borderRadius="xl"
        borderWidth="1px"
        borderColor="slate.200"
      >
        <Heading size="sm" mb={3} color="slate.900" fontWeight="700">
          Trace Feedback
        </Heading>
        <Textarea
          placeholder="Share your thoughts on this trace..."
          value={traceFeedback}
          onChange={(e) => setTraceFeedback(e.target.value)}
          rows={4}
          borderColor="slate.300"
          borderRadius="lg"
          _hover={{ borderColor: "brand.400" }}
          _focus={{ 
            borderColor: "brand.500", 
            boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            bg: "white"
          }}
          bg="white"
        />
        <Button
          mt={3}
          colorScheme="brand"
          size="md"
          w="full"
          fontWeight="600"
          borderRadius="lg"
          onClick={submitTraceFeedback}
          loading={submitting}
          disabled={!traceFeedback.trim()}
        >
          Submit Feedback
        </Button>
      </Box>
      
      {/* Slide-Specific Feedback */}
      {totalSlides > 0 && (
        <Box
          p={5}
          bg="slate.50"
          borderRadius="xl"
          borderWidth="1px"
          borderColor="slate.200"
        >
          <Heading size="sm" mb={3} color="slate.900" fontWeight="700">
            Slide {currentSlide} Feedback
          </Heading>
          <Textarea
            placeholder={`Share your thoughts on slide ${currentSlide}...`}
            value={slideFeedback}
            onChange={(e) => setSlideFeedback(e.target.value)}
            rows={4}
            borderColor="slate.300"
            borderRadius="lg"
            _hover={{ borderColor: "brand.400" }}
            _focus={{ 
              borderColor: "brand.500", 
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
              bg: "white"
            }}
            bg="white"
          />
          <Button
            mt={3}
            colorScheme="brand"
            size="md"
            w="full"
            fontWeight="600"
            borderRadius="lg"
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

