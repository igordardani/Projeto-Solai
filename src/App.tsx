import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, 
  Upload, 
  Trash2, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  ChevronRight,
  FileText,
  Activity,
  Sun,
  History,
  LayoutDashboard,
  RefreshCw,
  HardDrive,
  Pencil,
  Check,
  X,
  Smartphone,
  Mail,
  FileUp
} from "lucide-react";
import { PDFDocument } from 'pdf-lib';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  setDoc, 
  getDoc,
  getDocs,
  limit
} from "firebase/firestore";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserEntry, UserSettings } from "./types";
import { cn } from "./lib/utils";

const formatMonths = (totalMonths: number) => {
  if (isNaN(totalMonths)) return "N/A";
  const years = Math.floor(totalMonths / 12);
  const months = Math.floor(totalMonths % 12);
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Ano' : 'Anos'}`);
  if (months > 0 || (years === 0 && totalMonths > 0)) parts.push(`${months} ${months === 1 ? 'Mês' : 'Meses'}`);
  if (totalMonths === 0) return "0 Meses";
  return parts.join(' e ');
};

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/50',
      secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700',
      danger: 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20',
      ghost: 'hover:bg-slate-800 text-slate-400 hover:text-white',
      outline: 'border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white backdrop-blur-sm'
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-[10px] uppercase font-black tracking-widest',
      md: 'px-6 py-2.5 text-xs uppercase font-black tracking-widest',
      lg: 'px-8 py-4 text-sm uppercase font-black tracking-widest'
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed italic active:scale-95',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div 
    className={cn("bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm", className)}
    {...props}
  >
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, trend, trendColor, variant = 'white' }: { title: string, value: string, icon: any, trend?: string, trendColor?: string, variant?: 'white' | 'emerald' }) => (
  <Card className={cn(
    "p-6 flex flex-col justify-between transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] cursor-default group hover:shadow-2xl hover:shadow-emerald-500/10 min-h-[160px]",
    variant === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-900/40 border-slate-800"
  )}>
    <div className="flex justify-between items-start mb-4">
      <div className={cn(
        "p-3 rounded-2xl transition-all duration-500",
        variant === 'emerald' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-800 text-slate-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-400"
      )}>
        <Icon size={22} />
      </div>
      {trend && (
        <span 
          className={cn(
            "text-[10px] sm:text-[11px] font-black px-3 py-1.5 rounded-xl cursor-not-allowed transition-all uppercase tracking-widest italic leading-none shadow-sm",
            trendColor || (variant === 'emerald' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400 border border-slate-700")
          )}
        >
          {trend}
        </span>
      )}
    </div>
    <div className="space-y-1">
      <span className={cn(
        "text-[9px] font-black uppercase tracking-[0.2em] italic mb-1 block",
        variant === 'emerald' ? "text-emerald-400/80" : "text-slate-500"
      )}>
        {title}
      </span>
      <h3 className={cn(
        "text-xl sm:text-2xl font-black italic tracking-tighter leading-[1.1] break-words line-clamp-2",
        variant === 'emerald' ? "text-white" : "text-slate-100"
      )}>
        {value}
      </h3>
    </div>
  </Card>
);

const CircularProgress = ({ percent, remaining }: { percent: number, remaining: string }) => {
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col justify-between h-full py-2">
      <div>
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <div className="w-1.5 h-8 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
          <h3 className="text-white text-base md:text-lg font-black uppercase italic tracking-tight leading-none">Status de Retorno</h3>
        </div>
        
        <div className="relative w-40 h-40 sm:w-48 sm:h-48 mx-auto group">
          <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all duration-1000" />
          <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 36 36">
            <circle
              className="text-slate-800"
              strokeWidth="2.5"
              fill="none"
              stroke="currentColor"
              cx="18"
              cy="18"
              r={radius}
            />
            <circle
              className="text-emerald-500 transition-all duration-1000 ease-out"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              style={{ strokeDashoffset: dashoffset }}
              strokeLinecap="round"
              fill="none"
              stroke="currentColor"
              cx="18"
              cy="18"
              r={radius}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0 z-20">
            <span className="text-4xl sm:text-5xl font-black text-white italic tracking-tighter">{percent.toFixed(0)}<span className="text-xl sm:text-2xl text-emerald-500">%</span></span>
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 italic">Recuperado</span>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-950/40 rounded-2xl p-6 md:p-8 border border-slate-800/30 mt-8 mb-2">
        <div className="flex flex-col gap-2 mb-4">
          <span className="text-slate-400 font-black italic uppercase tracking-[0.2em] text-[10px] md:text-xs">Restante</span>
          <span className="font-black italic text-white text-2xl md:text-3xl tracking-tighter leading-none">{remaining}</span>
        </div>
        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 shadow-inner">
          <div 
            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-1000 relative" 
            style={{ width: `${percent}%` }}
          >
            <div className="absolute top-0 right-0 h-full w-4 bg-white/20 blur-sm animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ totalBill: 0, discountValue: 0 });
  const [newInvestment, setNewInvestment] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newInstallationDate, setNewInstallationDate] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    totalBill: "",
    discountValue: "",
    injectedkWh: ""
  });

  const maskCpf = (val: string) => {
    const numeric = val.replace(/\D/g, "").slice(0, 11);
    if (numeric.length <= 3) return numeric;
    if (numeric.length <= 6) return `${numeric.slice(0, 3)}.${numeric.slice(3)}`;
    if (numeric.length <= 9) return `${numeric.slice(0, 3)}.${numeric.slice(3, 6)}.${numeric.slice(6)}`;
    return `${numeric.slice(0, 3)}.${numeric.slice(3, 6)}.${numeric.slice(6, 9)}-${numeric.slice(9)}`;
  };

  const openSettings = () => {
    setNewInvestment(settings?.investmentValue?.toString() || "14000");
    setNewCpf(settings?.cpf ? maskCpf(settings.cpf) : "");
    setNewInstallationDate(settings?.installationDate || "");
    setIsSettingsOpen(true);
  };

  // Prepare chart data for growing visualization
  const chartData = useMemo(() => {
    let cumulative = 0;
    return entries.map(entry => {
      cumulative += entry.discountValue;
      return {
        name: `${entry.month}/${entry.year}`,
        recovered: cumulative,
        payback: settings?.investmentValue || 14000
      };
    });
  }, [entries, settings?.investmentValue]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>(() => {
    const saved = localStorage.getItem("SOLAI_AVAILABLE_MODELS");
    return saved ? JSON.parse(saved) : ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem("SOLAI_SELECTED_MODEL") || "gemini-2.5-flash";
  });
  const [apiKeyStatus, setApiKeyStatus] = useState<{ detected: boolean, length: number, masked: string }>({ 
    detected: false, 
    length: 0, 
    masked: "" 
  });

  // Persistir configurações de modelo
  useEffect(() => {
    localStorage.setItem("SOLAI_SELECTED_MODEL", selectedModel);
    localStorage.setItem("SOLAI_AVAILABLE_MODELS", JSON.stringify(availableModels));
  }, [selectedModel, availableModels]);
  // Função para obter a instância da IA com a chave limpa
  const getGenerativeAI = () => {
    const tempKey = localStorage.getItem("TEMP_GEMINI_KEY");
    const rawKey = tempKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    const apiKey = String(rawKey).replace(/[^\x21-\x7E]/g, "").replace(/['"]+/g, "").trim();

    if (apiKey && apiKey.startsWith("AIzaSy") && apiKey.length >= 35) {
      return new GoogleGenerativeAI(apiKey);
    }
    return null;
  };

  // Efeito para atualizar o status visual da chave
  useEffect(() => {
    const tempKey = localStorage.getItem("TEMP_GEMINI_KEY");
    const rawKey = tempKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    const apiKey = String(rawKey).replace(/[^\x21-\x7E]/g, "").replace(/['"]+/g, "").trim();

    if (apiKey && apiKey.length >= 10) {
      const masked = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`;
      if (apiKeyStatus.masked !== masked) {
        setApiKeyStatus({ detected: true, length: apiKey.length, masked });
      }
    } else if (apiKeyStatus.detected) {
      setApiKeyStatus({ detected: false, length: 0, masked: "" });
    }
  }, [entries]); // Atualiza quando mudar algo no app

  // Função para teste de AI
  const testAIIntegration = async (targetKey?: string) => {
    const raw = targetKey || localStorage.getItem("TEMP_GEMINI_KEY") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    const apiKey = String(raw).replace(/[^\x21-\x7E]/g, "").replace(/['"]+/g, "").trim();

    if (!apiKey || !apiKey.startsWith("AIzaSy")) {
      alert("❌ Chave inválida ou não encontrada.");
      return;
    }

    try {
      const ai = new GoogleGenerativeAI(apiKey);
      console.log(`Testando modelo: ${selectedModel}`);
      
      // O SDK geralmente adiciona 'models/' automaticamente, mas vamos garantir o formato limpo
      const modelId = selectedModel.includes("/") ? selectedModel.split("/").pop()! : selectedModel;
      const model = ai.getGenerativeModel({ model: modelId });
      
      const result = await model.generateContent("Diga 'OK'");
      const response = await result.response;
      alert(`✅ SUCESSO! O modelo ${modelId} respondeu: "${response.text()}"\nSua configuração está perfeita.`);
    } catch (err: any) {
      console.error("Erro no teste:", err);
      const msg = String(err);
      
      if (msg.includes("API key not valid")) {
        alert("❌ ERRO: Chave inválida ou recusada pelo Google.\n\nDICA: Verifique se não há espaços extras ao colar.");
      } else if (msg.includes("404") || msg.includes("not found")) {
        alert(`❌ ERRO 404: Modelo não encontrado.\n\nIsso geralmente significa que a 'Generative Language API' NÃO está habilitada no seu projeto do Google Cloud. Vá em 'Biblioteca' e ative-a.`);
      } else if (msg.includes("403") || msg.includes("permission")) {
        alert("❌ ERRO 403: Sem permissão. Sua chave pode ter restrições de IP ou Referrer ativadas.");
      } else {
        alert(`❌ FALHA: ${err.message || 'Erro de conexão'}`);
      }
    }
  };

  // Função para listar o que essa chave pode ver
  const listAvailableModels = async () => {
    const raw = localStorage.getItem("TEMP_GEMINI_KEY") || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    const apiKey = String(raw).replace(/[^\x21-\x7E]/g, "").replace(/['"]+/g, "").trim();

    if (!apiKey) {
      alert("Nenhuma chave configurada.");
      return;
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await response.json();
      
      if (data.models) {
        const names = data.models.map((m: any) => m.name.replace("models/", ""));
        setAvailableModels(names);
        if (names.length > 0 && !names.includes(selectedModel)) {
          setSelectedModel(names[0]);
        }
        alert("✅ Lista de modelos atualizada com sucesso no seletor abaixo!");
      } else {
        alert("❌ A chave foi aceita, mas não retornou nenhum modelo. A API provavelmente está desativada no seu projeto.");
      }
    } catch (err) {
      alert("Erro ao consultar modelos da chave.");
    }
  };

  // Função auxiliar para formatar erros da Gemini e do Sistema
  const getGeminiErrorMessage = (err: any) => {
    // Extrai a mensagem bruta
    let errorStr = "";
    if (typeof err === "string") {
      errorStr = err;
    } else if (err && err.message) {
      errorStr = err.message;
    } else {
      errorStr = String(err);
    }
    
    // Limpeza de prefixos técnicos comuns do JavaScript/Gemini
    const cleanMsg = errorStr
      .replace(/^Error:\s*/i, "")
      .replace(/^\[GoogleGenerativeAI Error\]:\s*/i, "")
      .replace(/\s*\(400\)\s*$/, "")
      .trim();

    // Se for um erro específico de validação (negócio), retorna ele mesmo já limpo
    if (cleanMsg.includes("Atenção:") || cleanMsg.includes("Já existe") || cleanMsg.includes("período")) {
      return cleanMsg;
    }

    if (cleanMsg.toLowerCase().includes("api key not valid")) {
      return `Chave de API inválida ou recusada. Verifique se a chave no Vercel está correta e ativa.`;
    }
    if (cleanMsg.toLowerCase().includes("quota exceeded")) {
      return "Limite de uso da AI (Cota Gratuita) excedido. Tente novamente em 1 minuto.";
    }
    
    // Fallback: Retorna a mensagem limpa ou uma padrão se estiver vazia
    return cleanMsg || "Ocorreu um erro inesperado no processamento.";
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Load Settings
    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "users", user.uid, "settings", "main"));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as UserSettings);
        } else {
          const defaultSettings = { investmentValue: 14000, userId: user.uid };
          await setDoc(doc(db, "users", user.uid, "settings", "main"), defaultSettings);
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    };
    loadSettings();

    // Check and Seed History if empty
    const checkAndSeed = async () => {
      try {
        const qSeed = query(collection(db, "users", user.uid, "entries"), limit(1));
        const snapshot = await getDocs(qSeed);
        
        if (snapshot.empty) {
          console.log("Carga inicial: Populando histórico da planilha...");
          const seedData = [
            [2023,7,148.12],[2023,8,145.22],[2023,9,196.52],[2023,10,261.23],[2023,11,289.65],[2023,12,396.43],
            [2024,1,370.94],[2024,2,310.17],[2024,3,359.09],[2024,4,262.80],[2024,5,249.40],[2024,6,185.47],
            [2024,7,157.22],[2024,8,150.60],[2024,9,192.51],[2024,10,279.17],[2024,11,202.45],[2024,12,206.72],
            [2025,1,339.20],[2025,2,230.87],[2025,3,302.59],[2025,4,224.42],[2025,5,152.02],[2025,6,154.32],
            [2025,7,149.27],[2025,8,154.11],[2025,9,200.42],[2025,10,253.86],[2025,11,239.83],[2025,12,272.40],
            [2026,1,332.88],[2026,2,268.18],[2026,3,386.59],[2026,4,349.02]
          ];
          
          // Seed in chunks
          for (let i = 0; i < seedData.length; i += 5) {
            const chunk = seedData.slice(i, i + 5);
            await Promise.all(chunk.map(([ano, mes, val]) => 
              addDoc(collection(db, "users", user.uid, "entries"), {
                year: ano,
                month: mes,
                discountValue: val,
                userId: user.uid,
                createdAt: serverTimestamp()
              })
            ));
          }
          console.log("Carga inicial concluída com sucesso.");
        }
      } catch (e) {
        console.error("Erro na carga inicial ou verificação:", e);
      }
    };
    checkAndSeed();

    // Load Entries
    const q = query(
      collection(db, "users", user.uid, "entries"),
      orderBy("year", "asc"),
      orderBy("month", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as UserEntry[];
      setEntries(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/entries`);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    // No Vercel (Pure SPA) ou ambientes externos, não temos as rotas /api Express, então pulamos o check de Drive
    const isExternal = window.location.hostname.includes('vercel.app') || 
                       window.location.hostname.includes('ngrok') || 
                       window.location.hostname.includes('webcontainer');

    if (!user || isExternal) {
      if (!user) setIsDriveConnected(false);
      return;
    }

    const checkDriveStatus = async () => {
      try {
        const response = await fetch(`/api/auth/google/status?uid=${user.uid}`);
        const data = await response.json();
        setIsDriveConnected(data.connected);
      } catch (err) {
        console.error("Drive status check error:", err);
      }
    };
    checkDriveStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_DRIVE_CONNECTED') {
        setIsDriveConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  const handleConnectDrive = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/auth/google/url?uid=${user.uid}`);
      const { url } = await response.json();
      window.open(url, 'google_auth_popup', 'width=600,height=700');
    } catch (err) {
      console.error("Error starting Drive auth:", err);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!user) return;
    try {
      // Small verification if we really want to disconnect
      if (!confirm("Deseja desconectar seu Google Drive? Isso não apagará seus arquivos, mas novos lançamentos não serão salvos lá.")) return;
      
      await deleteDoc(doc(db, "users", user.uid, "private", "googleTokens"));
      setIsDriveConnected(false);
    } catch (err) {
      console.error("Error disconnecting Drive:", err);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const investmentValue = settings?.investmentValue || 14000;
  const totalRecovered = entries.reduce((sum, entry) => sum + (entry.discountValue || 0), 0);
  const remainingValue = Math.max(0, investmentValue - totalRecovered);
  const profitValue = Math.max(0, totalRecovered - investmentValue);
  const progressPercent = investmentValue > 0 ? Math.min(100, (totalRecovered / investmentValue) * 100) : 0;

  const averageDiscount = totalRecovered / (entries.length || 1);
  const estimatedMonthsRemaining = averageDiscount > 0 ? remainingValue / averageDiscount : 0;

  const paybackInfo = useMemo(() => {
    let cumulative = 0;
    for (let i = 0; i < entries.length; i++) {
      cumulative += (entries[i].discountValue || 0);
      if (cumulative >= investmentValue) {
        return { reached: true, months: i + 1 };
      }
    }
    return { reached: false, months: 0 };
  }, [entries, investmentValue]);

  const handleUpdateEntry = async (id: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid, "entries", id), {
        totalBill: editForm.totalBill,
        discountValue: editForm.discountValue
      }, { merge: true });
      setEditingId(null);
      console.log("Lançamento atualizado com sucesso.");
    } catch (err) {
      console.error("Erro ao atualizar lançamento:", err);
    }
  };

  const startEditing = (entry: any) => {
    setEditingId(entry.id);
    setEditForm({ totalBill: entry.totalBill || 0, discountValue: entry.discountValue });
  };

  const handleFileUpload = async (eOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    let file: File | undefined;
    
    if (eOrFile instanceof File) {
      file = eOrFile;
    } else {
      file = eOrFile.target.files?.[0];
    }
    
    if (!file || !user) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Otimização Inteligente de PDF (Compactação via Corte de Páginas)
      // Se o PDF for maior que 750KB, tentamos extrair apenas a primeira página (onde estão os dados da fatura)
      let fileToProcess = file;
      
      if (file.size > 750 * 1024 && file.type === "application/pdf") {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pageCount = pdfDoc.getPageCount();
          
          if (pageCount > 1) {
            console.log(`Arquivo de ${(file.size / 1024).toFixed(2)}KB detectado. Extraindo primeira página para otimização...`);
            const newPdfDoc = await PDFDocument.create();
            const [firstPage] = await newPdfDoc.copyPages(pdfDoc, [0]);
            newPdfDoc.addPage(firstPage);
            
            const pdfBytes = await newPdfDoc.save();
            fileToProcess = new File([pdfBytes], `optimized_${file.name}`, { type: "application/pdf" });
            console.log(`Otimização concluída: ${(fileToProcess.size / 1024).toFixed(2)}KB`);
          }
        } catch (pdfLimitErr) {
          console.warn("Falha na otimização do PDF, prosseguindo com original:", pdfLimitErr);
        }
      }

      // 1. Read file as Base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(fileToProcess);
      });

      const base64Data = await fileDataPromise;

      // 2. Call Gemini API from Frontend
      console.log("Iniciando análise com AI...");
      const aiInstance = getGenerativeAI();
      if (!aiInstance) throw new Error("API key not valid");
      
      const prompt = `
        Você é um especialista em faturas de energia solar da Energisa Brasil.
        Analise esta fatura e extraia os seguintes dados estruturados em JSON:
        
        {
          "month": número do mês de referência (1-12),
          "year": número do ano de referência (ex: 2026),
          "totalBill": o valor total a pagar da fatura (R$),
          "discountValue": valor total dos créditos de energia injetada utilizados (soma dos itens negativos como 'Energia Injetada' ou 'Compensação GD'),
          "injectedkWh": quantidade de kWh injetados no mês (se houver),
          "isSolar": boolean se identifica sistema solar
        }
        
        IMPORTANTE: Se houver vários itens negativos, some-os para compor o discountValue.
        Retorne APENAS o JSON puro.
      `;

      console.log(`Chamando Gemini (${selectedModel}) no frontend...`);
      const model = aiInstance.getGenerativeModel({ model: selectedModel });

      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data
          }
        }
      ]);

      const response = await result.response;
      const responseText = response.text();
      console.log("Gemini Response:", responseText);

      // Clean response if AI adds markdown blocks
      const cleanJson = responseText.replace(/```json|```/g, "").trim();
      const extractedData = JSON.parse(cleanJson);

      // --- DUPLICATE CHECK ---
      const alreadyExists = entries.some(e => 
        Number(e.month) === Number(extractedData.month) && 
        Number(e.year) === Number(extractedData.year)
      );
      
      if (alreadyExists) {
        throw new Error(`Atenção: Já existe um lançamento para o período ${extractedData.month}/${extractedData.year}.`);
      }
      // -----------------------

      // 3. Save to Firebase & Optionally Drive
      const newEntry: any = {
        month: Number(extractedData.month),
        year: Number(extractedData.year),
        injectedkWh: Number(extractedData.injectedkWh),
        discountValue: Number(extractedData.discountValue),
        totalBill: Number(extractedData.totalBill),
        pdfName: file.name,
        userId: user.uid,
        createdAt: serverTimestamp()
      };

      if (isDriveConnected) {
        try {
          console.log("Fazendo upload para o Google Drive...");
          const driveResponse = await fetch("/api/drive/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: user.uid,
              fileName: file.name,
              fileBase64: base64Data,
              year: extractedData.year,
              month: extractedData.month,
            }),
          });
          
          if (driveResponse.ok) {
            const driveData = await driveResponse.json();
            newEntry.driveFileId = driveData.fileId;
            newEntry.driveLink = driveData.webViewLink;
            console.log("Upload para o Drive concluído:", driveData.fileId);
          } else {
            console.warn("Falha no upload para o Drive, salvando localmente se possível.");
          }
        } catch (driveErr) {
          console.error("Drive upload error:", driveErr);
        }
      }

      // Firestore limit is 1MB. Base64 is ~33% larger than binary.
      // 750KB * 1.33 = ~997KB. Very close to the limit.
      if (fileToProcess.size < 750000) {
        newEntry.pdfBase64 = `data:application/pdf;base64,${base64Data}`;
      } else {
        console.warn("PDF muito grande (>750KB) para o banco de dados mesmo após otimização. Salvando apenas os dados.");
        setUploadError("Dados extraídos com sucesso! Por segurança, o arquivo é muito grande e foi mantido apenas em nossa memória temporária.");
      }

      await addDoc(collection(db, "users", user.uid, "entries"), newEntry);
      console.log("Lançamento salvo com sucesso.");

    } catch (err: any) {
      console.error("Erro no processamento:", err);
      let msg = getGeminiErrorMessage(err);
      if (msg.includes("unexpected") && (err.message?.includes("JSON") || String(err).includes("JSON"))) {
        msg = "A IA retornou um formato de dados inválido. Tente novamente com outro arquivo.";
      }
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const alreadyExists = entries.some(e => 
        Number(e.month) === Number(manualForm.month) && 
        Number(e.year) === Number(manualForm.year)
      );
      
      if (alreadyExists) {
        alert(`Já existe um lançamento para ${manualForm.month}/${manualForm.year}.`);
        return;
      }

      await addDoc(collection(db, "users", user.uid, "entries"), {
        month: Number(manualForm.month),
        year: Number(manualForm.year),
        totalBill: Number(manualForm.totalBill),
        discountValue: Number(manualForm.discountValue),
        injectedkWh: Number(manualForm.injectedkWh) || 0,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      setIsManualAddOpen(false);
      setManualForm({ 
        month: new Date().getMonth() + 1, 
        year: new Date().getFullYear(),
        totalBill: "", 
        discountValue: "", 
        injectedkWh: "" 
      });
    } catch (err) {
      console.error("Error adding manual entry:", err);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!user) return;
    
    try {
      await deleteDoc(doc(db, "users", user.uid, "entries", id));
      setDeletingId(null);
      console.log("Lançamento excluído com sucesso.");
    } catch (err) {
      console.error("Erro ao excluir lançamento:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/entries/${id}`);
    }
  };

  const handleUpdateSettings = async () => {
    if (!user) return;
    try {
      const invValue = parseFloat(newInvestment);
      const newSettings: UserSettings = { 
        investmentValue: isNaN(invValue) ? 14000 : invValue, 
        userId: user.uid,
        cpf: newCpf.replace(/\D/g, ""), // Save numeric only
        installationDate: newInstallationDate
      };
      await setDoc(doc(db, "users", user.uid, "settings", "main"), newSettings);
      setSettings(newSettings);
      setIsSettingsOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f18]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#05080c] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 mb-12 animate-in fade-in zoom-in duration-1000">
          <div className="p-8 bg-emerald-500 rounded-[2.5rem] shadow-[0_0_80px_-12px_rgba(16,185,129,0.5)] rotate-6 hover:rotate-0 transition-all duration-700">
            <Sun size={80} className="text-white" />
          </div>
        </div>
        
        <h1 className="relative z-10 text-8xl md:text-9xl font-black text-white mb-6 uppercase italic tracking-tighter animate-in slide-in-from-bottom-8 duration-700">
          SOL<span className="text-emerald-500">AI</span>
        </h1>
        
        <p className="relative z-10 text-slate-400 max-w-lg mb-12 text-lg md:text-xl font-bold uppercase tracking-widest leading-loose italic opacity-60 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          Inteligência Artificial aplicada ao seu retorno energético
        </p>
        
        <button 
          onClick={handleLogin} 
          className="relative z-10 flex items-center gap-4 bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-6 rounded-[2.5rem] font-black italic uppercase tracking-[0.2em] transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)] active:scale-95 group animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500"
        >
          <LayoutDashboard size={28} className="group-hover:rotate-12 transition-transform" />
          CONECTAR COM GOOGLE
        </button>

        <div className="absolute bottom-8 text-[10px] text-slate-700 font-black uppercase tracking-[0.5em] italic">
          SECURE ENCRYPTED ACCESS • v2.0 PREMIUM
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#05080c] text-slate-300 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#05080c]/90 backdrop-blur-3xl border-b border-slate-900 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-col justify-between items-center lg:flex-row gap-6">
          <div className="flex items-center gap-4 sm:gap-6 group cursor-default w-full lg:w-auto">
            <div 
              className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/40 rotate-12 group-hover:rotate-0 transition-all duration-700"
            >
              <Sun className="text-white w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter leading-none">
                SOL<span className="text-emerald-500">AI</span>
              </h1>
              <div className="flex items-center gap-3 mt-1 sm:mt-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <p className="text-[10px] sm:text-xs text-slate-500 font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] italic leading-none">
                  Yield Dashboard • {user.displayName || user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto mt-2 lg:mt-0">
            {/* Box Volume Investido */}
            <div className="bg-slate-950/60 border border-slate-800/50 px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-6 group hover:border-emerald-500/30 transition-all">
              <div>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.3em] leading-none mb-2 italic">Volume Investido</p>
                <p 
                  className="text-xl sm:text-2xl font-black italic text-white cursor-pointer hover:text-emerald-500 transition-colors leading-none tracking-tighter"
                  onClick={openSettings}
                >
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(investmentValue)}
                </p>
              </div>
              <button 
                onClick={openSettings}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all group-hover:border-emerald-500/20"
              >
                <Pencil size={14} />
              </button>
            </div>
 
            {/* Botão de Sair */}
            <Button 
              variant="ghost" 
              className="h-[68px] w-14 flex items-center justify-center p-0 rounded-2xl border border-slate-800 bg-slate-950/60 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20 shadow-xl transition-all active:scale-90" 
              onClick={handleLogout}
              title="Sair da Sessão"
            >
              <LogOut size={22} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-8 px-4 pb-20">
        {/* Left Column: Stats, Charts, and Upload */}
        <div className="lg:col-span-3 space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
          {/* Upload Card - Moved to TOP of Left Column */}
          <Card 
            className={cn(
              "p-8 transition-all duration-500 relative overflow-hidden border-2 border-dashed group",
              isDragging 
                ? "bg-emerald-500/10 border-emerald-400 scale-[1.02] shadow-2xl shadow-emerald-500/20" 
                : "bg-slate-900 border-slate-800 hover:border-emerald-500/20"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
          >
            <div className="absolute -top-10 -right-10 opacity-5 group-hover:opacity-10 transition-all duration-700 -rotate-12">
              <Upload size={240} className={isDragging ? "text-emerald-500" : "text-emerald-400"} />
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all duration-700 shadow-2xl",
                isDragging ? "bg-emerald-500 text-white scale-110 rotate-3" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              )}>
                {isUploading ? (
                  <RefreshCw className="animate-spin" size={32} />
                ) : (
                  <FileUp size={32} />
                )}
              </div>
              
              <h4 className={cn(
                "font-black text-2xl mb-2 transition-colors uppercase italic tracking-tighter",
                isDragging ? "text-emerald-400" : "text-white"
              )}>
                {isUploading ? "Processando..." : "Arquivar Nova Conta"}
              </h4>
              
              <p className={cn(
                "text-xs mb-8 max-w-[240px] leading-relaxed transition-colors font-bold uppercase tracking-widest opacity-60",
                isDragging ? "text-emerald-300" : "text-slate-500"
              )}>
                {isDragging 
                  ? "Solte para iniciar o upload" 
                  : "Arraste o PDF para extração automática via Inteligência Artificial"}
              </p>
              
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />

              <div className="grid grid-cols-1 gap-4 w-full">
                <Button 
                  variant={isDragging ? "primary" : "outline"} 
                  size="lg" 
                  disabled={isUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className={cn(
                    "w-full transition-all py-4 h-auto rounded-2xl italic font-black uppercase tracking-widest",
                    isDragging 
                      ? "bg-emerald-600 border-none hover:bg-emerald-700 shadow-xl shadow-emerald-600/20" 
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700"
                  )}
                >
                  {isUploading ? <RefreshCw size={20} className="mr-3 animate-spin"/> : <FileUp size={20} className="mr-3" />}
                  {isUploading ? "PROCESSANDO..." : "IMPORTAR PDF"}
                </Button>

                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full transition-all py-4 h-auto rounded-2xl border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 italic font-black uppercase tracking-widest"
                  onClick={() => setIsManualAddOpen(true)}
                >
                  <Plus size={20} className="mr-3" />
                  LANÇAMENTO MANUAL
                </Button>
              </div>
              
              {uploadError && (
                <div className="text-rose-400 text-xs mt-6 font-bold px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 text-center">
                  {uploadError}
                </div>
              )}
            </div>
          </Card>

          {/* Progress Card */}
          <Card className="p-8 sm:col-span-2 lg:col-span-1 shadow-2xl shadow-emerald-500/5 border-slate-800/50">
            <CircularProgress 
              percent={progressPercent} 
              remaining={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingValue)} 
            />
          </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
            {/* Recovery Stats */}
            <StatCard 
              title="Total Recuperado" 
              value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecovered)} 
              icon={CheckCircle2}
              variant="emerald"
            />

            <StatCard 
              title="Estimativa Payback" 
              value={remainingValue > 0 
                ? `~${formatMonths(Math.ceil(estimatedMonthsRemaining))}` 
                : paybackInfo.reached 
                  ? `${formatMonths(paybackInfo.months)}`
                  : "Atingido!"
              } 
              icon={TrendingUp}
              trend={remainingValue > 0 ? "Em Curso" : "Concluído"}
              trendColor={remainingValue > 0 ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"}
            />

            <StatCard 
              title="Tempo de Projeto" 
              value={formatMonths(entries.length)} 
              icon={Calendar}
              trend={remainingValue === 0 ? "Pago!" : "Em progresso"}
              trendColor={remainingValue === 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"}
            />
          </div>

          {/* Chart Card (Moved to Left) */}
          <Card 
            className={cn(
              "flex flex-col gap-4 overflow-hidden transition-all duration-700 cursor-pointer group bg-slate-900 shadow-2xl relative",
              isChartExpanded 
                ? "fixed inset-0 sm:inset-[5%] z-50 p-10 border-emerald-500/20 backdrop-blur-3xl" 
                : "p-8 hover:border-emerald-500/30 min-h-[350px] border-slate-800"
            )}
            onClick={() => setIsChartExpanded(!isChartExpanded)}
          >
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex items-center justify-center rounded-2xl transition-all duration-500 shadow-xl shadow-emerald-500/10",
                  isChartExpanded ? "w-16 h-16 bg-emerald-500 text-white" : "w-12 h-12 bg-emerald-500/10 text-emerald-400"
                )}>
                  <Activity size={isChartExpanded ? 32 : 24} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] leading-none mb-1">Indicador de Performance</p>
                  <p className={cn("font-black text-white italic uppercase tracking-tighter leading-none", isChartExpanded ? "text-3xl" : "text-xl")}>
                    {isChartExpanded ? "Análise Estratégica" : "Evolução do Ativo"}
                  </p>
                </div>
              </div>
              
              {!isChartExpanded && (
                <div className="flex items-center gap-3">
                  <div className="text-[10px] text-emerald-400 font-black flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all uppercase tracking-widest italic">
                    Expurgar Dados <ChevronRight size={14} />
                  </div>
                </div>
              )}
              
              {isChartExpanded && (
                <button className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-95 shadow-lg">
                  <X size={32} />
                </button>
              )}
            </div>
            
            <div className={cn("w-full transition-all duration-700 flex flex-col", isChartExpanded ? "flex-1 mt-12" : "h-[280px] mt-4")}>
              {chartData.length > 0 ? (
                <div className="flex-1 w-full min-h-0 bg-slate-950/30 rounded-2xl p-4 border border-slate-800/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                      <defs>
                        <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPayback" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="5 5" 
                        vertical={false} 
                        stroke="rgba(255, 255, 255, 0.05)" 
                      />
                      <XAxis 
                        dataKey="name" 
                        hide={!isChartExpanded}
                        axisLine={false}
                        tickLine={false} 
                        tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                      />
                      <YAxis 
                        hide={!isChartExpanded}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#475569', fontSize: 9, fontWeight: 900 }}
                        tickFormatter={(v) => `R$${Math.floor(v/1000)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '12px' }}
                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                        cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="recovered" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorRecovered)" 
                        name="Acumulado"
                        animationDuration={1500}
                      />
                      {isChartExpanded && (
                        <Area
                          type="stepAfter"
                          dataKey="payback"
                          stroke="#f43f5e"
                          strokeWidth={1}
                          strokeDasharray="8 8"
                          fill="url(#colorPayback)"
                          name="Meta Payback"
                          animationDuration={1000}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                  <Activity size={64} className="opacity-10 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">Aguardando Inteligência</span>
                </div>
              )}
            </div>
            
            {isChartExpanded && (
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Média Mensal", value: totalRecovered / (entries.length || 1), color: "slate" },
                  { label: "Total Desconto", value: totalRecovered, color: "emerald" },
                  { label: "Payback Restante", value: remainingValue, color: "rose" },
                  { label: "Lucro Real", value: profitValue, color: "blue" }
                ].map((stat, i) => (
                  <div key={i} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl transition-all hover:border-slate-700">
                    <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-2 italic">{stat.label}</p>
                    <p className={cn("text-2xl font-black italic tracking-tighter", `text-${stat.color}-500 text-white`)}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stat.value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {isChartExpanded && (
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all focus:outline-none"
              onClick={() => setIsChartExpanded(false)}
            />
          )}

        </div>


        {/* Right Column: History Table */}
        <div className="lg:col-span-9 space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
          <Card className="flex flex-col min-h-[900px] h-fit overflow-hidden border-slate-800 bg-slate-900/40 shadow-2xl">
            {/* Header do Card (Título e Filtros) */}
            <div className="shrink-0 p-8 border-b border-slate-800/50 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-slate-900 shadow-xl gap-6 z-30">
              <div className="flex items-center gap-6">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <History size={28} />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-white font-black tracking-tighter uppercase italic text-3xl leading-none">Histórico de Lançamentos</h3>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-1.5 shadow-inner">
                <button 
                  onClick={() => setSortOrder('desc')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all tracking-widest",
                    sortOrder === 'desc' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Recentes
                </button>
                <button 
                  onClick={() => setSortOrder('asc')}
                  className={cn(
                    "px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all tracking-widest",
                    sortOrder === 'asc' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  Antigos
                </button>
              </div>
            </div>

            {/* Container com Scroll para o conteúdo */}
            <div className="flex-1 overflow-x-auto scrollbar-hide relative bg-transparent custom-scrollbar">
              {/* Desktop View: Table */}
              <div className="hidden lg:block">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="z-30">
                      <th className="sticky top-0 z-30 px-10 py-8 text-[13px] font-black uppercase tracking-widest text-slate-500 italic border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">Competência</th>
                      <th className="sticky top-0 z-30 px-10 py-8 text-[13px] font-black uppercase tracking-widest text-slate-500 italic border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl text-right">Valor Conta</th>
                      <th className="sticky top-0 z-30 px-10 py-8 text-[13px] font-black uppercase tracking-widest text-emerald-500 italic border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl text-right">Desconto</th>
                      <th className="sticky top-0 z-30 px-10 py-8 text-[13px] font-black uppercase tracking-widest text-slate-500 italic border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl text-right">Saldo Restante</th>
                      <th className="sticky top-0 z-30 px-10 py-8 text-[13px] font-black uppercase tracking-widest text-slate-500 italic border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl text-center">Fatura</th>
                      <th className="sticky top-0 z-30 px-10 py-8 text-[13px] font-black uppercase tracking-widest text-slate-500 italic border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {entries.length > 0 ? (() => {
                      let runningBalance = investmentValue;
                      // 1. Calculate Balance with ORIGINAL ASC ORDER
                      const rowsWithBalance = entries.map(entry => {
                        runningBalance = Math.max(0, runningBalance - entry.discountValue);
                        return { ...entry, balanceAtTime: runningBalance };
                      });
                      
                      // 2. Apply Visual Order
                      const finalDisplay = sortOrder === 'desc' ? [...rowsWithBalance].reverse() : rowsWithBalance;
                      
                      return finalDisplay.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-900/40 transition-all duration-300 group">
                          <td className="px-10 py-8 font-black italic text-white text-xl whitespace-nowrap tracking-tighter">
                            {entry.month.toString().padStart(2, '0')}/{entry.year}
                          </td>
                          <td className="px-10 py-8 text-right text-slate-400 font-black italic text-lg group-hover:text-slate-200 transition-colors">
                            {editingId === entry.id ? (
                               <div className="flex items-center justify-end gap-2 pr-2">
                                 <span className="text-[10px] text-slate-600 font-black italic select-none">R$</span>
                                 <input 
                                   type="text" 
                                   inputMode="decimal"
                                   className="w-24 bg-transparent border-b border-emerald-500/50 text-right text-white text-xl focus:ring-0 outline-none font-black italic pr-2"
                                   value={editForm.totalBill}
                                   onChange={(e) => setEditForm({ ...editForm, totalBill: e.target.value.replace(/[^0-9.]/g, '') === '' ? 0 : Number(e.target.value.replace(/[^0-9.]/g, '')) })}
                                   autoFocus
                                 />
                               </div>
                            ) : (
                              entry.totalBill ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.totalBill) : '—'
                            )}
                          </td>
                          <td className="px-10 py-8 text-right font-black italic text-emerald-400 text-xl">
                            {editingId === entry.id ? (
                               <div className="flex items-center justify-end gap-2 pr-2">
                                 <span className="text-[10px] text-emerald-600/70 font-black italic select-none">-R$</span>
                                 <input 
                                   type="text" 
                                   inputMode="decimal"
                                   className="w-24 bg-transparent border-b border-emerald-500/50 text-right text-emerald-400 text-xl focus:ring-0 outline-none font-black italic pr-2"
                                   value={editForm.discountValue}
                                   onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value.replace(/[^0-9.]/g, '') === '' ? 0 : Number(e.target.value.replace(/[^0-9.]/g, '')) })}
                                 />
                               </div>
                            ) : (
                              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.discountValue)
                            )}
                          </td>
                          <td className="px-10 py-8 text-right text-white font-black italic text-xl tracking-tighter">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.balanceAtTime)}
                          </td>
                          <td className="px-10 py-8 text-center">
                            <div className="flex items-center justify-center">
                              {entry.driveLink ? (
                                <a 
                                  href={entry.driveLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
                                >
                                  <FileText size={24} />
                                </a>
                              ) : entry.pdfBase64 ? (
                                <button 
                                  className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg"
                                  onClick={() => {
                                    const base64Data = entry.pdfBase64!.split(',')[1];
                                    const byteCharacters = atob(base64Data);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    const file = new Blob([byteArray], { type: 'application/pdf;base64' });
                                    const fileURL = URL.createObjectURL(file);
                                    window.open(fileURL, '_blank');
                                  }}
                                >
                                  <FileText size={24} />
                                </button>
                              ) : (
                                <span className="text-[12px] text-slate-700 font-black italic opacity-40 uppercase tracking-widest">N/A</span>
                              )}
                            </div>
                          </td>
                          <td className="px-10 py-8 text-center">
                            <div className="flex items-center justify-center gap-4">
                              {editingId === entry.id ? (
                                 <div className="flex items-center gap-3">
                                 <button 
                                   onClick={() => handleUpdateEntry(entry.id)}
                                   className="p-3 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-400 transition-all shadow-lg"
                                 >
                                   <Check size={20} />
                                 </button>
                                 <button 
                                   onClick={() => setEditingId(null)}
                                   className="p-3 bg-slate-800 text-slate-400 rounded-2xl hover:bg-slate-700 hover:text-white transition-all"
                                 >
                                   <X size={20} />
                                 </button>
                               </div>
                              ) : deletingId === entry.id ? (
                                <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                                  <button 
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="p-3 bg-rose-500 text-white rounded-2xl hover:bg-rose-400 transition-all shadow-lg shadow-rose-500/20"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                  <button 
                                    onClick={() => setDeletingId(null)}
                                    className="p-3 bg-slate-800 text-slate-400 rounded-2xl hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                                  >
                                    <X size={20} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => startEditing(entry)}
                                    className="p-3 text-slate-500 hover:text-emerald-400 transition-all"
                                  >
                                    <Pencil size={20} />
                                  </button>
                                  <button 
                                    onClick={() => setDeletingId(entry.id)}
                                    className="p-3 text-slate-500 hover:text-rose-500 transition-all"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ));
                    })() : (
                      <tr>
                        <td colSpan={6} className="px-8 py-40 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-800 gap-6 opacity-30 group">
                            <Activity size={100} className="group-hover:scale-110 transition-transform duration-700" />
                            <p className="text-[10px] font-black uppercase tracking-[0.8em] italic">Aguardando Lançamentos Estratégicos</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Row-based Cards */}
              <div className="lg:hidden p-4 space-y-4">
                {entries.length > 0 ? (() => {
                  let runningBalance = investmentValue;
                  // 1. Calculate Balance with ORIGINAL ASC ORDER
                  const rowsWithBalance = entries.map(entry => {
                    runningBalance = Math.max(0, runningBalance - entry.discountValue);
                    return { ...entry, balanceAtTime: runningBalance };
                  });
                  
                  // 2. Apply Visual Order
                  const finalDisplay = sortOrder === 'desc' ? [...rowsWithBalance].reverse() : rowsWithBalance;
                  
                  return finalDisplay.map((entry) => (
                    <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                          <span className="text-white font-black italic text-lg">{entry.month.toString().padStart(2, '0')}/{entry.year}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                           {editingId === entry.id || deletingId === entry.id ? (
                             <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={editingId === entry.id ? () => handleUpdateEntry(entry.id) : () => handleDeleteEntry(entry.id)}
                                  className={cn("p-1.5 rounded-lg text-white transition-all shadow-lg", editingId === entry.id ? "bg-emerald-500" : "bg-rose-500")}
                                >
                                  <Check size={14} />
                                </button>
                                <button 
                                  onClick={() => { setEditingId(null); setDeletingId(null); }}
                                  className="bg-slate-700 text-slate-200 p-1.5 rounded-lg"
                                >
                                  <X size={14} />
                                </button>
                             </div>
                           ) : (
                             <div className="flex items-center gap-1">
                               <button 
                                 onClick={() => startEditing(entry)}
                                 className="text-slate-400 p-1.5 hover:bg-slate-800 rounded-lg"
                               >
                                 <Pencil size={16} />
                               </button>
                               <button 
                                 onClick={() => setDeletingId(entry.id)}
                                 className="text-slate-400 p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg"
                               >
                                 <Trash2 size={16} />
                               </button>
                             </div>
                           )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-4">
                        <div className="space-y-0.5">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Valor Conta</p>
                          <div className="text-slate-200 font-mono text-sm">
                             {editingId === entry.id ? (
                               <input 
                                 type="text" 
                                 inputMode="decimal"
                                 className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-right outline-none focus:ring-1 focus:ring-emerald-500/50 pr-4 italic font-black"
                                 value={editForm.totalBill}
                                 onChange={(e) => setEditForm({ ...editForm, totalBill: e.target.value.replace(/[^0-9.]/g, '') === '' ? 0 : Number(e.target.value.replace(/[^0-9.]/g, '')) })}
                               />
                             ) : (
                               entry.totalBill ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.totalBill) : '—'
                             )}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Desconto</p>
                            <div className="flex items-center gap-2">
                               {entry.driveLink ? (
                                 <a href={entry.driveLink} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-lg" title="Google Drive">
                                   <HardDrive size={18} />
                                 </a>
                               ) : entry.pdfBase64 ? (
                                 <button 
                                   className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-lg"
                                   title="Visualizar PDF"
                                   onClick={() => {
                                      const base64Data = entry.pdfBase64!.split(',')[1];
                                      const byteCharacters = atob(base64Data);
                                      const byteNumbers = new Array(byteCharacters.length);
                                      for (let i = 0; i < byteCharacters.length; i++) {
                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                      }
                                      const byteArray = new Uint8Array(byteNumbers);
                                      const file = new Blob([byteArray], { type: 'application/pdf' });
                                      const fileURL = URL.createObjectURL(file);
                                      window.open(fileURL, '_blank');
                                   }}
                                 >
                                   <FileText size={18} />
                                 </button>
                               ) : null}
                            </div>
                          </div>
                          <div className="text-emerald-400 font-mono font-bold text-sm">
                             {editingId === entry.id ? (
                               <input 
                                 type="text" 
                                 inputMode="decimal"
                                 className="w-full bg-slate-950 border border-emerald-500/20 rounded-lg p-2 text-right outline-none focus:ring-1 focus:ring-emerald-500/50 text-emerald-400 pr-4 italic font-black"
                                 value={editForm.discountValue}
                                 onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value.replace(/[^0-9.]/g, '') === '' ? 0 : Number(e.target.value.replace(/[^0-9.]/g, '')) })}
                               />
                             ) : (
                               new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.discountValue)
                             )}
                          </div>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-slate-800/50">
                          <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl border border-slate-800/30">
                            <div>
                               <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Saldo Restante</p>
                               <p className="text-white font-black font-mono italic text-sm">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.balanceAtTime)}
                               </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })() : (
                  <div className="py-20 text-center text-slate-600">
                    <History size={40} className="mx-auto mb-4 opacity-10" />
                    <p className="text-[10px] font-black uppercase italic tracking-widest opacity-40">Aguardando Lançamentos</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Manual Add Modal */}
      {isManualAddOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10 pointer-events-none">
          <div className="absolute inset-0 bg-[#05080c]/90 backdrop-blur-3xl animate-in fade-in duration-500 pointer-events-auto" onClick={() => setIsManualAddOpen(false)} />
          <div className="relative w-full max-w-lg animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500 pointer-events-auto">
            <Card className="bg-slate-900 border-slate-800 p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                    <Plus size={28} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Lançamento</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1 italic">Entrada de dados manuais</p>
                  </div>
                </div>
                <button onClick={() => setIsManualAddOpen(false)} className="p-3 text-slate-500 hover:text-white transition-colors bg-slate-950 rounded-xl hover:bg-slate-800 border border-slate-800">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-1">Mês de Competência</label>
                    <select 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-black italic focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all appearance-none cursor-pointer"
                      value={manualForm.month}
                      onChange={(e) => setManualForm({ ...manualForm, month: Number(e.target.value) })}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-1">Ano Civil</label>
                    <select 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-black italic focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all appearance-none cursor-pointer"
                      value={manualForm.year}
                      onChange={(e) => setManualForm({ ...manualForm, year: Number(e.target.value) })}
                    >
                      {Array.from({ length: 5 }, (_, i) => (
                        <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-1">Valor Total da Fatura (Bruto)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black italic text-lg opacity-50">R$</span>
                    <input 
                      type="number" 
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-16 pr-6 py-5 text-white font-black italic text-xl focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all placeholder:text-slate-800"
                      value={manualForm.totalBill}
                      onChange={(e) => setManualForm({ ...manualForm, totalBill: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-1">Valor do Crédito Injetado (Desconto)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black italic text-lg">R$</span>
                    <input 
                      type="number" 
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-emerald-500/10 rounded-2xl pl-16 pr-6 py-5 text-emerald-400 font-black italic text-xl focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all placeholder:text-slate-800 shadow-[0_0_30px_rgba(16,185,129,0.05)]"
                      value={manualForm.discountValue}
                      onChange={(e) => setManualForm({ ...manualForm, discountValue: e.target.value })}
                    />
                  </div>
                  <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest ml-1 animate-pulse italic">Este valor será deduzido do saldo devedor</p>
                </div>

                <Button 
                  className="w-full py-6 mt-6 rounded-[2rem] text-lg lg:text-xl shadow-[0_20px_40px_rgba(16,185,129,0.2)]"
                  onClick={handleManualAdd}
                >
                  <Plus size={24} className="mr-3" />
                  Efetivar Lançamento
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal de Diagnóstico de IA */}
      {isDiagnosticOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <Card className="w-full max-w-lg p-8 border-emerald-500/30">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black italic text-white tracking-tighter">DIAGNÓSTICO SOLAI</h2>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-1">Status da Integração Gemini</p>
              </div>
              <button onClick={() => setIsDiagnosticOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <X className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Chave Detectada</span>
                <div className="flex items-center gap-3 mt-2">
                  <div className={cn("w-3 h-3 rounded-full animate-pulse", apiKeyStatus.detected ? "bg-emerald-500" : "bg-rose-500")} />
                  <code className="text-xs text-emerald-400 font-mono break-all">
                    {apiKeyStatus.detected ? apiKeyStatus.masked : "Nenhuma chave encontrada no ambiente (Vercel)"}
                  </code>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Escolher Modelo</label>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-all"
                >
                  {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Forçar Nova Chave (Local)</label>
                <input 
                  type="password"
                  placeholder="Cole aqui: AIzaSy..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-all"
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (val.startsWith("AIzaSy")) {
                      localStorage.setItem("TEMP_GEMINI_KEY", val);
                    }
                  }}
                />
                <p className="text-[9px] text-slate-500 leading-relaxed">
                  Dica: Use isso para testar chaves rapidamente. A chave fica salva apenas no seu navegador.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                <Button onClick={() => testAIIntegration()} className="flex-1 min-w-[140px]">Testar Conexão</Button>
                <Button 
                  variant="outline" 
                  onClick={listAvailableModels}
                  className="flex-1 min-w-[140px] border-blue-500/30 text-blue-400"
                >
                  Listar Modelos
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    localStorage.removeItem("TEMP_GEMINI_KEY");
                    window.location.reload();
                  }}
                  className="flex-1 min-w-[140px]"
                >
                  Resetar
                </Button>
              </div>

              <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                <p className="text-[10px] text-blue-400 font-medium leading-relaxed italic">
                  "Para evitar erros de restrição, prefira criar a chave em <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline font-bold">aistudio.google.com</a> em vez do Google Cloud Console."
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-10 pointer-events-none">
          <div className="absolute inset-0 bg-[#05080c]/90 backdrop-blur-3xl animate-in fade-in duration-500 pointer-events-auto" onClick={() => setIsSettingsOpen(false)} />
          <div className="relative w-full max-w-lg animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500 pointer-events-auto">
            <Card className="bg-slate-900 border-slate-800 p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                    <Activity size={28} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">Diretrizes</h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1 italic">Configuração do Ativo Solar</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-3 text-slate-500 hover:text-white transition-colors bg-slate-950 rounded-xl hover:bg-slate-800 border border-slate-800">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-1">Capex do Projeto (Investimento Total)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black italic text-lg">R$</span>
                    <input 
                      type="number" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-16 pr-6 py-5 text-white font-black italic text-xl focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all"
                      value={newInvestment}
                      onChange={(e) => setNewInvestment(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest italic ml-1">Data de Implementação / Início</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-white font-black italic text-xl focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all appearance-none"
                    value={newInstallationDate}
                    onChange={(e) => setNewInstallationDate(e.target.value)}
                  />
                </div>

                <div className="pt-6">
                  <Button 
                    className="w-full py-6 rounded-[2rem] text-lg lg:text-xl shadow-[0_20px_40px_rgba(16,185,129,0.2)]"
                    onClick={handleUpdateSettings}
                  >
                    <Check size={24} className="mr-3" />
                    Consolidar Ativos
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
