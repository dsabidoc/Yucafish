import Link from "next/link";
import { Fish, Waves } from "lucide-react";
export default function NotFound() { return <main className="error-screen" id="main-content"><span><Waves /></span><Fish /><h1>Esta ruta no llegó a puerto</h1><p>No encontramos la página que buscas. Tu bitácora sigue a salvo.</p><Link className="button primary" href="/">Volver al inicio</Link></main>; }
