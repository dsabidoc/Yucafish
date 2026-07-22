import Link from "next/link";
import { ShieldX } from "lucide-react";
export default function ForbiddenPage() { return <main className="error-screen" id="main-content"><span><ShieldX /></span><h1>Acceso denegado</h1><p>No tienes permiso para consultar este registro.</p><Link className="button primary" href="/app">Volver a mi bitácora</Link></main>; }
