import { Spinner } from "@heroui/spinner";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner color="primary" size="lg" />
        <p className="text-default-500">Loading questionnaire template...</p>
      </div>
    </div>
  );
}
