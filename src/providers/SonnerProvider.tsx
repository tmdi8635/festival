"use client";

import { CheckCircle, Close, Info, Warning } from "@/icons";
import { Toaster } from "sonner";

const SonnerProvider = () => {
  return (
    <Toaster
      position="top-center"
      closeButton
      duration={3000}
      offset={24}
      visibleToasts={3}
      icons={{
        success: <CheckCircle className="text-success" size={20} />,
        error: <Warning className="text-danger" size={20} />,
        warning: <Warning className="text-warning" size={20} />,
        info: <Info className="text-info" size={20} />,
        close: <Close className="text-font-disabled" size={18} />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "sonner-toast",
          title: "text-[14px] font-semibold text-font-1",
          description: "mt-0.5 text-[13px] text-font-2",
          closeButton:
            "absolute right-3 top-3 cursor-pointer transition hover:opacity-70",
        },
      }}
    />
  );
};

export default SonnerProvider;
