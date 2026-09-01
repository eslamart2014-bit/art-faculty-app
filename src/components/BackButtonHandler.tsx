"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function BackButtonHandler() {
  const pathname = usePathname();
  const [backPressCount, setBackPressCount] = useState(0);

  useEffect(() => {
    const handlePopState = (e: any) => {
      const allDivs = document.querySelectorAll('div');
      const modals: HTMLElement[] = [];
      
      allDivs.forEach(el => {
        const style = window.getComputedStyle(el);
        if (
          style.position === 'fixed' &&
          parseInt(style.zIndex || '0') >= 40 &&
          (style.width === '100%' || style.width === window.innerWidth + 'px' || style.right === '0px') &&
          (style.height === '100%' || style.height === window.innerHeight + 'px' || style.bottom === '0px')
        ) {
          modals.push(el);
        }
      });

      modals.sort((a, b) => {
        return parseInt(window.getComputedStyle(a).zIndex) - parseInt(window.getComputedStyle(b).zIndex);
      });

      if (modals.length > 0) {
        window.history.pushState(null, "", window.location.href);
        const topModal = modals[modals.length - 1];
        topModal.click();
        return;
      }

      if (pathname === "/") {
        if (backPressCount === 0) {
          window.history.pushState(null, "", window.location.href);
          setBackPressCount(1);
          const toast = document.createElement("div");
          toast.innerText = "اضغط مرة أخرى للخروج";
          toast.style.position = "fixed";
          toast.style.bottom = "50px";
          toast.style.left = "50%";
          toast.style.transform = "translateX(-50%)";
          toast.style.background = "rgba(0,0,0,0.8)";
          toast.style.color = "#fff";
          toast.style.padding = "10px 20px";
          toast.style.borderRadius = "20px";
          toast.style.zIndex = "9999";
          toast.style.fontSize = "14px";
          document.body.appendChild(toast);
          setTimeout(() => {
            setBackPressCount(0);
            if (document.body.contains(toast)) document.body.removeChild(toast);
          }, 2000);
          return;
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    if (window.history.state === null) {
      window.history.pushState({ page: pathname }, "", window.location.href);
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname, backPressCount]);

  return null;
}
