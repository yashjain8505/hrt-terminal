import Link from "next/link";
export default function NotFound() {
  return <div className="p-10 text-muted">No such screen. <Link href="/" className="text-amber link">TAPE &lt;GO&gt;</Link></div>;
}
