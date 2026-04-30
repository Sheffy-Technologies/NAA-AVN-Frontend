import React from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, className }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className={`bg-[#001825] rounded-lg shadow-lg max-w-lg w-full p-6 relative ${className || ""}`} role="dialog" aria-modal="true">
        {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-400"
          onClick={onClose}
          aria-label="Close modal"
        >
          <span aria-hidden="true">&times;</span>
        </button>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
