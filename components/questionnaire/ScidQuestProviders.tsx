"use client";

import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { ScidQuestProvider, QuestionnaireAIProvider } from "scidquest";
import { useMemo } from "react";

import { createApiLLMService } from "@/lib/llm-service";

const scidQuestTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#e86161" },
    secondary: { main: "#1e88e5" },
  },
});

export function ScidQuestProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const llmService = useMemo(() => createApiLLMService(), []);

  return (
    <ThemeProvider theme={scidQuestTheme}>
      <CssBaseline />
      <QuestionnaireAIProvider>
        <ScidQuestProvider llmService={llmService}>
          {children}
        </ScidQuestProvider>
      </QuestionnaireAIProvider>
    </ThemeProvider>
  );
}
