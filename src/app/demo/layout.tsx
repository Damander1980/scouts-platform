import DemoBar from "./DemoBar";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBar />
      {children}
    </>
  );
}
