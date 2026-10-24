"use client";

import { useState } from "react";

// A password box with an eye button to show what you typed (and hide it again).
export default function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  const { className = "input w-full", ...rest } = props;
  return (
    <div className="relative">
      <input {...rest} type={show ? "text" : "password"} className={`${className} pr-12`} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-transparent border-0 cursor-pointer text-smoke">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
          {show && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}
