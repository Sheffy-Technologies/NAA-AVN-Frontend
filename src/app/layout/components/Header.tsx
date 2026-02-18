import { Icon } from "@iconify/react";

type HeaderProps = {
  onOpenSidebar?: () => void;
};

export const Header = ({ onOpenSidebar }: HeaderProps) => {
  return (
    <header className="h-16 bg-[#001219] border-b border-[#0A4D66]/30 px-4 md:px-6 flex items-center justify-between">
      {/* Left: Mobile menu + Date/Time */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden p-2 rounded-full hover:bg-[#0A4D66]/30 text-gray-300"
          onClick={onOpenSidebar}
        >
          <Icon icon="mdi:menu" className="w-5 h-5" />
        </button>
        <div className="text-gray-400 text-xs sm:text-sm font-medium truncate">
          Monday, 26 January 2026 | 22:14 ZULU | Abuja
        </div>
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Icon
            icon="mdi:magnify"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5"
          />
          <input
            type="text"
            placeholder="Search"
            className="bg-[#00090D] border border-[#0A4D66]/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FD5FF] w-52 md:w-64 transition-colors"
          />
        </div>

        {/* Icons */}
        <div className="flex items-center gap-2 text-gray-400">
          <button className="p-2 hover:bg-[#0A4D66]/30 rounded-full transition-colors relative">
            <Icon icon="mdi:email-outline" className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-[#0A4D66]/30 rounded-full transition-colors relative">
            <Icon icon="mdi:bell-outline" className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-[#0A4D66]/30 rounded-full transition-colors relative">
            <Icon icon="mdi:account-circle-outline" className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>
    </header>
  );
};
