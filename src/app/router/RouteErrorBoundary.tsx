import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export const RouteErrorBoundary = () => {
  const error = useRouteError() as unknown;
  let title = "Something went wrong";
  let message = "An unexpected error occurred. Please try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message =
      (typeof error.data === "object" && error.data && "message" in error.data
        ? (error.data as { message?: string }).message
        : undefined) || message;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#00090D] text-gray-100 px-4">
      <div className="max-w-md w-full bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6 space-y-3">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-gray-300">{message}</p>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          className="mt-2 px-4 py-2 rounded-md bg-[#7FD5FF] text-black text-sm font-medium w-full hover:bg-[#7FD5FF]/90 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

