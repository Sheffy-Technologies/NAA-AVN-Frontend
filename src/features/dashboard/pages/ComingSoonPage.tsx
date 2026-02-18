import { useLocation } from "react-router-dom";

export const ComingSoonPage = () => {
  const location = useLocation();
  const pageName = location.pathname
    .split("/")
    .pop()
    ?.replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="w-20 h-20 bg-[#0A4D66]/20 rounded-full flex items-center justify-center">
        <span className="text-3xl">🚧</span>
      </div>
      <h2 className="text-2xl font-bold text-white">
        {pageName || "Page"} Coming Soon
      </h2>
      <p className="text-gray-400 max-w-md">
        This module is currently under development. Check back later for
        updates.
      </p>
    </div>
  );
};
