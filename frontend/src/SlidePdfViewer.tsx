import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Box, Button, HStack, Badge, Flex, Text, Spinner } from "@chakra-ui/react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface SlidePdfViewerProps {
  pdfUrl: string;
  onPageChange?: (page: number) => void;
  onNumPagesChange?: (numPages: number) => void;
}

export default function SlidePdfViewer({ pdfUrl, onPageChange, onNumPagesChange }: SlidePdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const updateCurrentPage = (page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  };

  useEffect(() => {
    updateCurrentPage(1);
  }, [pdfUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setCurrentPage((prev) => {
          const newPage = Math.max(1, prev - 1);
          onPageChange?.(newPage);
          return newPage;
        });
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setCurrentPage((prev) => {
          const newPage = Math.min(numPages, prev + 1);
          onPageChange?.(newPage);
          return newPage;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, onPageChange]);

  return (
    <Flex direction="column" h="full" bg="slate.50">
      <Box 
        bg="white" 
        borderBottomWidth="1px" 
        borderColor="slate.200" 
        p={4}
      >
        <HStack justify="center" gap={3}>
          <Button
            size="md"
            colorScheme="brand"
            variant="outline"
            borderRadius="xl"
            fontWeight="600"
            px={6}
            shadow="subtle"
            _hover={{ shadow: "premium", transform: "scale(1.02)" }}
            _active={{ transform: "scale(0.98)" }}
            transition="all 0.15s"
            onClick={() => updateCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <HiChevronLeft style={{ marginRight: '4px' }} />
            Previous
          </Button>

          <Badge 
            colorScheme="brand" 
            fontSize="md" 
            px={6} 
            py={3} 
            borderRadius="full"
            fontWeight="700"
            shadow="subtle"
          >
            Slide {currentPage} of {numPages || "..."}
          </Badge>

          <Button
            size="md"
            colorScheme="brand"
            variant="outline"
            borderRadius="xl"
            fontWeight="600"
            px={6}
            shadow="subtle"
            _hover={{ shadow: "premium", transform: "scale(1.02)" }}
            _active={{ transform: "scale(0.98)" }}
            transition="all 0.15s"
            onClick={() => updateCurrentPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage === numPages}
          >
            Next
            <HiChevronRight style={{ marginLeft: '4px' }} />
          </Button>
        </HStack>
      </Box>

      <Flex
        ref={(el) => {
          if (el && containerWidth === 0) {
            setContainerWidth(el.clientWidth - 48);
          }
        }}
        flex="1"
        align="center"
        justify="center"
        p={6}
        overflow="auto"
      >
        <Box shadow="premium" borderRadius="2xl" overflow="hidden" borderWidth="1px" borderColor="slate.200">
          <Document
            file={pdfUrl}
            onLoadSuccess={(doc) => {
              setNumPages(doc.numPages);
              onNumPagesChange?.(doc.numPages);
            }}
            loading={
              <HStack p={8} gap={3}>
                <Spinner color="brand.500" />
                <Text color="slate.600" fontWeight="500">Loading slides…</Text>
              </HStack>
            }
            error={<Text color="red.500" p={8} fontWeight="600">Failed to load PDF</Text>}
          >
            <Page
              pageNumber={currentPage}
              width={containerWidth > 0 ? Math.min(containerWidth, 1200) : undefined}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={
                <Flex
                  w={containerWidth > 0 ? Math.min(containerWidth, 1200) : 800}
                  h={containerWidth > 0 ? Math.min(containerWidth, 1200) * 0.5625 : 450}
                  bg="white"
                  align="center"
                  justify="center"
                >
                  <Spinner color="brand.500" />
                </Flex>
              }
            />
          </Document>
        </Box>
      </Flex>

      <Box bg="white" borderTopWidth="1px" borderColor="slate.200" py={2} textAlign="center">
        <Text fontSize="xs" color="slate.500" fontWeight="500">
          Use <Box as="kbd" px={1} py={0.5} bg="slate.100" borderRadius="sm" fontSize="xs" display="inline" fontWeight="600">←</Box>{" "}
          <Box as="kbd" px={1} py={0.5} bg="slate.100" borderRadius="sm" fontSize="xs" display="inline" fontWeight="600">→</Box> arrow keys to navigate
        </Text>
      </Box>
    </Flex>
  );
}
