import { MapApp } from "./components/MapApp";
import "./styles.css";

export default function App() {
  const compact = window.location.hash.includes("radar");
  return <MapApp compact={compact} />;
}
