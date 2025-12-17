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
}

export default function SlidePdfViewer({ pdfUrl, onPageChange }: SlidePdfViewerProps) {
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
    <Flex direction="column" h="full" bg="blue.50">
      <Box bg="white" borderBottomWidth="2px" borderColor="blue.200" p={4} shadow="md">
        <HStack justify="center" gap={4}>
          <Button
            size="md"
            colorScheme="blue"
            variant="outline"
            borderRadius="lg"
            shadow="sm"
            _hover={{ shadow: "md", transform: "translateY(-1px)" }}
            onClick={() => updateCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <HiChevronLeft style={{ marginRight: '4px' }} />
            Previous
          </Button>

          <Badge colorScheme="blue" fontSize="md" px={6} py={2} borderRadius="full" shadow="sm">
            Slide {currentPage} of {numPages || "..."}
          </Badge>

          <Button
            size="md"
            colorScheme="blue"
            variant="outline"
            borderRadius="lg"
            shadow="sm"
            _hover={{ shadow: "md", transform: "translateY(-1px)" }}
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
        <Box shadow="2xl" borderRadius="2xl" overflow="hidden" borderWidth="2px" borderColor="blue.200">
          <Document
            file={pdfUrl}
            onLoadSuccess={(doc) => setNumPages(doc.numPages)}
            loading={
              <HStack p={8} gap={3}>
                <Spinner color="brand.500" />
                <Text>Loading slides…</Text>
              </HStack>
            }
            error={<Text color="red.500" p={8}>Failed to load PDF</Text>}
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

      <Box bg="white" borderTopWidth="1px" borderColor="gray.200" py={2} textAlign="center">
        <Text fontSize="xs" color="gray.500">
          Use <Box as="kbd" px={1} py={0.5} bg="gray.100" borderRadius="sm" fontSize="xs" display="inline">←</Box>{" "}
          <Box as="kbd" px={1} py={0.5} bg="gray.100" borderRadius="sm" fontSize="xs" display="inline">→</Box> arrow keys to navigate
        </Text>
      </Box>
    </Flex>
  );
}
