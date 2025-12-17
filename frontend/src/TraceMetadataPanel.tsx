import { Box, HStack, VStack, Text, Badge, Button, createToaster } from "@chakra-ui/react";
import { HiExternalLink, HiClipboardCopy } from "react-icons/hi";

const toaster = createToaster({
  placement: "top-end",
  pauseOnPageIdle: true,
});

interface TraceMetadataPanelProps {
  traceId: string;
  traceName: string;
  projectName: string;
  langsmithUrl?: string;
  createdAt: string;
}

export default function TraceMetadataPanel({
  traceId,
  traceName,
  projectName,
  langsmithUrl,
  createdAt,
}: TraceMetadataPanelProps) {
  const copyTraceId = () => {
    navigator.clipboard.writeText(traceId);
    toaster.success({
      title: "Copied!",
      description: "Trace ID copied to clipboard",
    });
  };

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="slate.200"
      borderRadius="2xl"
      p={6}
      shadow="subtle"
      mb={4}
    >
      <VStack align="stretch" gap={4}>
        {/* Title Row */}
        <HStack justify="space-between" align="center">
          <VStack align="start" gap={1}>
            <Text fontSize="2xl" fontWeight="700" color="slate.900">
              {traceName}
            </Text>
            <Text fontSize="sm" color="slate.500">
              {new Date(createdAt).toLocaleString()}
            </Text>
          </VStack>
          
          {langsmithUrl && (
            <a
              href={langsmithUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Button
                size="md"
                colorScheme="brand"
                variant="outline"
                borderRadius="lg"
                fontWeight="600"
                _hover={{ bg: "brand.50", transform: "translateY(-1px)" }}
                transition="all 0.2s"
              >
                <HiExternalLink style={{ marginRight: '6px' }} />
                Open in LangSmith
              </Button>
            </a>
          )}
        </HStack>

        {/* Metadata Row */}
        <HStack gap={4} flexWrap="wrap">
          <HStack
            bg="slate.50"
            px={4}
            py={2}
            borderRadius="lg"
            borderWidth="1px"
            borderColor="slate.200"
          >
            <Text fontSize="xs" fontWeight="600" color="slate.500" textTransform="uppercase">
              Trace ID
            </Text>
            <Text fontSize="sm" fontFamily="mono" color="slate.900" fontWeight="600">
              {traceId.slice(0, 8)}...{traceId.slice(-8)}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={copyTraceId}
              _hover={{ bg: "slate.100" }}
            >
              <HiClipboardCopy />
            </Button>
          </HStack>

          <Badge
            colorScheme="purple"
            px={4}
            py={2}
            borderRadius="lg"
            fontSize="sm"
            fontWeight="600"
          >
            Project: {projectName}
          </Badge>
        </HStack>
      </VStack>
    </Box>
  );
}

