declare module "@orkg/scidquest" {
  import type {
    Dispatch,
    ReactNode,
    RefObject,
    SetStateAction,
  } from "react";

  export function ScidQuestProvider(props: {
    children: ReactNode;
    llmService: unknown;
  }): ReactNode;

  export function QuestionnaireAIProvider(props: {
    children: ReactNode;
  }): ReactNode;

  export function ResearchQuestionnaireWorkspaceProvider(props: {
    children: ReactNode;
    value: Record<string, unknown>;
  }): ReactNode;

  export function useResearchQuestionnaireWorkspace(): Record<
    string,
    unknown
  > | null;

  export function buildQuestionDefinitions(
    template: unknown,
  ): Record<string, unknown>;

  export function siblingQuestionIdsFor(
    template: unknown,
    questionId: string,
  ): string[];

  export type ResearchFieldAiQuestionType =
    | "text"
    | "select"
    | "multi_select"
    | "repeat_text"
    | "group";

  export function ResearchQuestionnaireFieldAiWrapper(props: {
    children: ReactNode;
    questionId: string;
    questionText: string;
    questionType: ResearchFieldAiQuestionType;
    questionOptions?: string[];
    currentAnswer: string;
    onApplySuggestion: (text: string) => void;
    disableAi?: boolean;
    parentContext?: unknown;
    onVerificationComplete?: (result: unknown) => void;
  }): ReactNode;

  export function PDFUpload(props: {
    maxSizeBytes?: number;
    onFileSelected: (file: File) => void;
    onFileRemoved?: () => void;
    accept?: string;
    disabled?: boolean;
    sx?: Record<string, unknown>;
  }): ReactNode;

  export function PdfViewer(props: {
    refContainer: RefObject<HTMLElement | null>;
    pdfUrl: string;
    pageWidth?: number;
    registerCommands?: (cmd: { goToPage: (page: number) => void }) => void;
    onTextExtracted?: (text: string) => void;
    onExtractionError?: (error: Error) => void;
    highlights?: Record<string, unknown>;
    pdfTextExtractor: {
      extractFullText: (url: string) => Promise<string>;
    };
  }): ReactNode;

  export function AIConfigurationDialog(
    props: Record<string, unknown>,
  ): ReactNode;

  export interface UploadedPdf {
    id: string;
    name: string;
    size: number;
    url: string;
    extractionStatus: "idle" | "extracting" | "done" | "error";
    extractedText?: string;
    structuredDocument?: unknown | null;
    extractionError?: Error | null;
  }

  export function ResearchQuestionnaireApp(props: {
    templateSpec: unknown;
    pdfTextExtractor?: {
      extractFullText: (url: string) => Promise<string>;
    };
    structuredPdfExtractor?: unknown;
    maxPdfSizeBytes?: number;
    layout?: "split" | "single";
    showPdfViewer?: boolean;
    onAnswersChange?: (answers: Record<string, unknown>) => void;
    initialAnswers?: Record<string, unknown>;
    sx?: Record<string, unknown>;
    questionnaireSlot?: (ctx: Record<string, unknown>) => ReactNode;
    answers?: Record<string, unknown>;
    setAnswers?: Dispatch<SetStateAction<Record<string, unknown>>>;
    multiple?: boolean;
    maxFiles?: number;
    /** Controlled files state (host manages persistence). */
    controlledFiles?: UploadedPdf[];
    /** Controlled active file ID. */
    controlledActiveFileId?: string | null;
    /** Callback when files change. */
    onFilesChange?: (files: UploadedPdf[]) => void;
    /** Callback when active file changes. */
    onActiveFileIdChange?: (id: string | null) => void;
  }): ReactNode;

  export function AIAssistantButton(
    props: Record<string, unknown>,
  ): ReactNode;

  export function SuggestionBox(props: Record<string, unknown>): ReactNode;

  export function PdfFileTabsConnected(): ReactNode;

  export const pdfFileStore: {
    getState(): { files: UploadedPdf[]; activeFileId: string | null };
    subscribe(listener: () => void): () => void;
    addFiles(files: UploadedPdf[]): void;
    removeFile(id: string): void;
    setActiveFileId(id: string): void;
    updateFile(id: string, updates: Partial<UploadedPdf>): void;
    reset(): void;
  };

  export function usePdfFileStore(): { files: UploadedPdf[]; activeFileId: string | null };
}
