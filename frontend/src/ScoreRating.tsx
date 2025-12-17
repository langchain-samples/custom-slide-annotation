import { HStack, Box, Text } from "@chakra-ui/react";
import { useState } from "react";

interface ScoreRatingProps {
  value: number;
  onChange: (score: number) => void;
  label: string;
  disabled?: boolean;
}

export default function ScoreRating({ value, onChange, label, disabled }: ScoreRatingProps) {
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  
  const scores = [1, 2, 3, 4, 5];
  
  const getScoreColor = (score: number) => {
    if (score <= 2) return "red";
    if (score === 3) return "orange";
    return "green";
  };
  
  const getScoreLabel = (score: number) => {
    const labels = ["Poor", "Fair", "Good", "Very Good", "Excellent"];
    return labels[score - 1];
  };
  
  return (
    <Box>
      <Text fontSize="xs" fontWeight="600" color="slate.600" mb={2}>
        {label}
      </Text>
      <HStack gap={3} mb={1}>
        {scores.map((score) => {
          const isSelected = value === score;
          
          return (
            <Box
              key={score}
              as="button"
              w="40px"
              h="40px"
              borderRadius="full"
              borderWidth="2px"
              borderColor={isSelected ? `${getScoreColor(score)}.500` : "slate.300"}
              bg={isSelected ? `${getScoreColor(score)}.50` : "white"}
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor={disabled ? "not-allowed" : "pointer"}
              opacity={disabled ? 0.5 : 1}
              _hover={!disabled ? { 
                borderColor: `${getScoreColor(score)}.400`,
                bg: `${getScoreColor(score)}.50`,
                transform: "scale(1.1)"
              } : {}}
              transition="all 0.15s"
              onClick={() => !disabled && onChange(score)}
              onMouseEnter={() => !disabled && setHoveredScore(score)}
              onMouseLeave={() => setHoveredScore(null)}
            >
              <Text 
                fontWeight="700" 
                fontSize="md"
                color={isSelected ? `${getScoreColor(score)}.700` : "slate.600"}
              >
                {score}
              </Text>
            </Box>
          );
        })}
      </HStack>
      {(hoveredScore || value > 0) && (
        <Text fontSize="xs" color="slate.500" fontWeight="500" mt={1}>
          {getScoreLabel(hoveredScore || value)}
        </Text>
      )}
    </Box>
  );
}

