import { Analytics } from "@vercel/analytics/react";
import CalculadoraCMR from "./CalculadoraCMR.jsx";

export default function App() {
  return (
    <>
      <CalculadoraCMR />
      <Analytics />
    </>
  );
}
