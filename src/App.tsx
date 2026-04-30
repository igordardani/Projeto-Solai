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
  X
} from "lucide-react";
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

import { GoogleGenAI } from "@google/genai";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserEntry, UserSettings } from "./types";
import { cn } from "./lib/utils";

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
      danger: 'bg-rose-500 text-white hover:bg-rose-600',
      ghost: 'hover:bg-slate-100 text-slate-600',
      outline: 'border border-slate-200 hover:bg-slate-50 text-slate-700'
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg'
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
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

const StatCard = ({ title, value, icon: Icon, trend, trendColor, onTrendClick, variant = 'white' }: { title: string, value: string, icon: any, trend?: string, trendColor?: string, onTrendClick?: () => void, variant?: 'white' | 'emerald' }) => (
  <Card className={cn(
    "p-5 flex flex-col justify-center transition-all duration-300 hover:border-emerald-500/30",
    variant === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20" : ""
  )}>
    <div className="flex justify-between items-start mb-1">
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-wider",
        variant === 'emerald' ? "text-emerald-400" : "text-slate-400"
      )}>
        {title}
      </span>
      {trend && (
        <span 
          onClick={onTrendClick}
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-opacity hover:opacity-80",
            trendColor || (variant === 'emerald' ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-400")
          )}
        >
          {trend}
        </span>
      )}
    </div>
    <h3 className={cn(
      "text-2xl font-black italic",
      variant === 'emerald' ? "text-white" : "text-slate-100"
    )}>
      {value}
    </h3>
  </Card>
);

const CircularProgress = ({ percent, remaining }: { percent: number, remaining: string }) => {
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <h3 className="text-white text-xs font-black uppercase italic tracking-widest mb-6 underline decoration-emerald-500/50 decoration-2 underline-offset-4">Progresso de Payback</h3>
        <div className="relative w-40 h-40 mx-auto">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle
              className="text-slate-800"
              strokeWidth="3"
              fill="none"
              stroke="currentColor"
              cx="18"
              cy="18"
              r={radius}
            />
            <circle
              className="text-emerald-500 transition-all duration-1000 ease-out"
              strokeWidth="3"
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
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className="text-3xl font-black text-white">{percent.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-300 font-bold uppercase">Recuperado</span>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800 pt-4 mt-6">
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-white font-black italic uppercase tracking-[0.2em] text-[10px]">Faltam</span>
          <span className="font-bold text-slate-200">{remaining}</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-emerald-500 h-full transition-all duration-1000" 
            style={{ width: `${percent}%` }}
          />
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

  // Initialize Gemini AI
  const aiRef = useRef<any>(null);
  if (!aiRef.current) {
    aiRef.current = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY as string) });
  }

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
    if (!user) {
      setIsDriveConnected(false);
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
      // 1. Read file as Base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = await fileDataPromise;

      // 2. Call Gemini API from Frontend
      const ai = aiRef.current;
      
      const prompt = `
        Analise esta fatura da Energisa e retorne EXATAMENTE um JSON com este formato:
        {
          "month": número do mês (1-12),
          "year": número do ano (ex: 2024),
          "injectedkWh": total de energia injetada no mês,
          "discountValue": total de descontos GD aplicados (valor que reduziu a conta),
          "totalBill": o valor total a pagar da fatura
        }
        
        REGRAS CRÍTICAS PARA "discountValue":
        - Identifique todos os itens com valor NEGATIVO na coluna 'Valor (R$)'.
        - O "discountValue" deve ser a SOMA ABSOLUTA desses valores negativos (ex: se houver -268,18, retorne 268.18).
        - IGNORE itens positivos (ex: 'Ajuste GDII') que aumentem a conta.
        Retorne APENAS o objeto JSON puro, sem blocos de código markdown (\`\`\`json) e sem explicações.
      `;

      console.log("Chamando Gemini no frontend...");
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64Data
                }
              }
            ]
          }
        ]
      });

      const responseText = result.text;
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
      if (file.size < 750000) {
        newEntry.pdfBase64 = `data:application/pdf;base64,${base64Data}`;
      } else {
        console.warn("PDF muito grande (>750KB) para o banco de dados. Salvando apenas os dados.");
        setUploadError("Dados extraídos com sucesso! Porém, o PDF original é muito grande para ser armazenado para download.");
      }

      await addDoc(collection(db, "users", user.uid, "entries"), newEntry);
      console.log("Lançamento salvo com sucesso.");

    } catch (err: any) {
      console.error("Erro no processamento:", err);
      let msg = "Erro ao processar PDF";
      if (err.message?.includes("API key")) {
        msg = "Chave API do Gemini inválida ou não configurada.";
      } else if (err.message?.includes("JSON")) {
        msg = "A IA retornou um formato inválido. Tente novamente.";
      } else {
        msg = err.message || msg;
      }
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (!user || isNaN(parseFloat(newInvestment))) return;
    try {
      const newSettings = { investmentValue: parseFloat(newInvestment), userId: user.uid };
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
      <div className="min-h-screen bg-[#0a0f18] flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-8 p-6 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <Sun size={64} className="text-emerald-500" />
        </div>
        <h1 className="text-5xl font-black text-white mb-3 uppercase italic tracking-tight">Solai</h1>
        <p className="text-slate-400 max-w-md mb-10 text-base font-medium leading-relaxed">
          Acompanhe o retorno do seu investimento em energia solar de forma fácil e automática através das suas faturas.
        </p>
        <button 
          onClick={handleLogin} 
          className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black italic uppercase tracking-wider transition-all shadow-xl shadow-emerald-600/20 active:scale-95 group"
        >
          <LayoutDashboard size={20} className="group-hover:rotate-12 transition-transform" />
          Entrar com Google
        </button>
      </div>
    );
  }

  const investmentValue = settings?.investmentValue || 14000;
  const totalRecovered = entries.reduce((sum, entry) => sum + entry.discountValue, 0);
  const remainingValue = Math.max(0, investmentValue - totalRecovered);
  const profitValue = Math.max(0, totalRecovered - investmentValue);
  const progressPercent = Math.min(100, (totalRecovered / investmentValue) * 100);

  return (
    <div className="min-h-screen bg-[#0a0f18] text-slate-300 font-sans p-4 sm:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sun className="text-emerald-500" size={24} />
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase italic">Solai</h1>
          </div>
          <p className="text-slate-400 text-sm font-medium">Monitoramento de Retorno Energético • {user.displayName}</p>
        </div>
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-sm flex-1 sm:flex-none hover:border-emerald-500/30 transition-colors">
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider underline decoration-emerald-500/30 decoration-2 underline-offset-4">Investimento</span>
            <span 
              className="text-lg font-black italic text-white cursor-pointer hover:text-emerald-500 transition-colors"
              onClick={() => {
                setNewInvestment(investmentValue.toString());
                setIsSettingsOpen(true);
              }}
            >
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(investmentValue)}
            </span>
          </div>
          
          <div 
            onClick={isDriveConnected ? handleDisconnectDrive : handleConnectDrive}
            className={cn(
              "px-4 py-2 rounded-xl shadow-sm cursor-pointer transition-all border flex items-center gap-2",
              isDriveConnected 
                ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100" 
                : "bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg",
              isDriveConnected ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
            )}>
              <HardDrive size={14} />
            </div>
            <div>
              <span className="text-[10px] block uppercase font-bold tracking-wider">Google Drive</span>
              <span className="text-xs font-bold leading-tight">
                {isDriveConnected ? "Conectado" : "Conectar"}
              </span>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-rose-600 self-center">
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Stats and Charts */}
        <div className="lg:col-span-3 space-y-6">
          {/* Progress Card */}
          <Card className="p-6">
            <CircularProgress 
              percent={progressPercent} 
              remaining={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingValue)} 
            />
          </Card>

          {/* Recovery Stats */}
          <StatCard 
            title="Total Recuperado" 
            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecovered)} 
            icon={CheckCircle2}
            variant="emerald"
          />

          <StatCard 
            title="Saldos & Meses" 
            value={`${entries.length} Meses`} 
            icon={Calendar}
            trend={remainingValue === 0 ? "Pago!" : "Em progresso"}
            trendColor={remainingValue === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}
          />

          {/* Chart Card */}
          <Card 
            className={cn(
              "p-6 flex flex-col gap-4 overflow-hidden transition-all duration-500 cursor-pointer group bg-slate-900/50",
              isChartExpanded 
                ? "fixed top-[10%] left-[5%] right-[5%] bottom-[10%] z-50 shadow-2xl border-slate-800" 
                : "relative hover:border-emerald-500/30"
            )}
            onClick={() => setIsChartExpanded(!isChartExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center rounded-xl transition-all",
                  isChartExpanded ? "w-12 h-12 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "w-8 h-8 bg-emerald-500/10 text-emerald-400"
                )}>
                  <Activity size={isChartExpanded ? 24 : 16} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Crescimento de Retorno</p>
                  <p className={cn("font-bold text-white uppercase tracking-tight", isChartExpanded ? "text-xl" : "text-xs")}>
                    {isChartExpanded ? "Análise Estratégica de Payback" : "Evolução do Investimento"}
                  </p>
                </div>
              </div>
              {!isChartExpanded && (
                <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                  VER DETALHES <Plus size={12} />
                </div>
              )}
              {isChartExpanded && (
                <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                  <X size={24} />
                </button>
              )}
            </div>
            
            <div className={cn("w-full transition-all duration-500", isChartExpanded ? "flex-1 mt-8" : "h-44 mt-4")}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    
                    <CartesianGrid 
                      strokeDasharray="4 4" 
                      vertical={false} 
                      stroke={isChartExpanded ? "rgba(255, 255, 255, 0.05)" : "transparent"} 
                    />
                    
                    <XAxis 
                      dataKey="name" 
                      hide={!isChartExpanded}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      dy={10}
                    />

                    <YAxis 
                      hide={!isChartExpanded}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />

                    <Tooltip 
                      cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '5 5' }}
                      contentStyle={{ 
                        borderRadius: '20px', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                        padding: '16px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(8px)'
                      }}
                      itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}
                      labelStyle={{ marginBottom: '8px', color: '#94a3b8', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}
                      formatter={(value: any, name: string) => [
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 
                        name === 'recovered' ? 'Acumulado' : 'Investimento'
                      ]}
                    />

                    <Area 
                      type="monotone" 
                      dataKey="recovered" 
                      stroke="#10b981" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorRecovered)" 
                      name="recovered"
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                    />
                    
                    {isChartExpanded && (
                      <Area
                        type="step"
                        dataKey="payback"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        strokeDasharray="8 8"
                        fill="transparent"
                        name="payback"
                        activeDot={false}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                  <Activity size={32} className="opacity-20" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Aguardando Lançamentos</span>
                </div>
              )}
            </div>
            
            {isChartExpanded && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Média Mensal</p>
                  <p className="text-xl font-bold text-slate-100 italic">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecovered / (entries.length || 1))}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Total Recuperado</p>
                  <p className="text-xl font-bold text-emerald-500 italic">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecovered)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <p className="text-[10px] text-rose-400 font-bold uppercase mb-1">Falta para Payback</p>
                  <p className="text-xl font-bold text-rose-500 italic">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingValue)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">Lucro Real (Pós-Payback)</p>
                  <p className="text-xl font-bold text-blue-500 italic">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(profitValue)}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {isChartExpanded && (
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all focus:outline-none"
              onClick={() => setIsChartExpanded(false)}
            />
          )}

          {/* Upload Card - Enhanced Dropzone */}
          <Card 
            className={cn(
              "p-6 transition-all duration-300 relative overflow-hidden border-2 border-dashed",
              isDragging 
                ? "bg-emerald-50/50 border-emerald-400 scale-[1.02] shadow-lg shadow-emerald-100" 
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
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
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Upload size={80} className={isDragging ? "text-emerald-500" : "text-emerald-400"} />
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-all duration-500",
                isDragging ? "bg-emerald-500 text-white scale-110" : "bg-emerald-500/10 text-emerald-400"
              )}>
                {isUploading ? (
                  <RefreshCw className="animate-spin" size={24} />
                ) : (
                  <Upload size={24} />
                )}
              </div>
              
              <h4 className={cn(
                "font-bold text-base mb-1 transition-colors",
                isDragging ? "text-emerald-900" : "text-white"
              )}>
                {isUploading ? "Processando Fatura..." : "Leitura Inteligente"}
              </h4>
              
              <p className={cn(
                "text-xs mb-6 max-w-[200px] leading-relaxed transition-colors",
                isDragging ? "text-emerald-700/70" : "text-slate-400"
              )}>
                {isDragging 
                  ? "Solte para iniciar o upload" 
                  : "Arraste sua fatura PDF para processar o desconto"}
              </p>
              
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />

              <Button 
                variant={isDragging ? "primary" : "outline"} 
                size="md" 
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className={cn(
                  "w-full transition-all",
                  isDragging 
                    ? "bg-emerald-600 border-none hover:bg-emerald-700" 
                    : "border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                )}
              >
                {isUploading ? "Aguarde..." : "Selecionar Arquivo"}
              </Button>
              
              {uploadError && (
                <p className="text-rose-400 text-[10px] mt-4 font-medium px-2 py-1 bg-rose-500/10 rounded-lg animate-in fade-in slide-in-from-top-2">
                  {uploadError}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: History Table */}
        <div className="lg:col-span-9">
          <Card className="flex flex-col min-h-[1000px]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
              <h3 className="text-white font-black tracking-tight uppercase italic text-lg">Histórico de Lançamentos</h3>
            </div>
            <div className="flex-1 overflow-auto text-xs sm:text-base">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-900 text-slate-200 uppercase text-[11px] font-black z-10 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-5 min-w-[80px]">Ref.</th>
                    <th className="px-5 py-5 text-right min-w-[120px]">Valor Conta</th>
                    <th className="px-5 py-5 text-right min-w-[120px]">Desconto</th>
                    <th className="px-5 py-5 text-right min-w-[140px]">Saldo Restante</th>
                    <th className="px-5 py-5 text-center min-w-[110px]">Fatura</th>
                    <th className="px-5 py-5 text-center min-w-[110px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {entries.length > 0 ? (() => {
                    let runningBalance = investmentValue;
                    const rowsWithBalance = entries.map(entry => {
                      runningBalance = Math.max(0, runningBalance - entry.discountValue);
                      return { ...entry, balanceAtTime: runningBalance };
                    });
                    
                    return rowsWithBalance.reverse().map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-800/40 transition-all group border-l-2 border-l-transparent hover:border-l-emerald-500/50">
                        <td className="px-5 py-5 font-black italic text-white text-base whitespace-nowrap">
                          {entry.month.toString().padStart(2, '0')}/{entry.year}
                        </td>
                        <td className="px-5 py-5 text-right text-slate-100 font-mono text-base font-medium">
                          {editingId === entry.id ? (
                            <div className="relative inline-block">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold italic">R$</span>
                              <input 
                                type="number" 
                                className="w-20 sm:w-28 pl-6 pr-1 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-right text-sm text-white focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={editForm.totalBill}
                                onChange={(e) => setEditForm({ ...editForm, totalBill: Number(e.target.value) })}
                                autoFocus
                              />
                            </div>
                          ) : (
                            entry.totalBill ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.totalBill) : '—'
                          )}
                        </td>
                        <td className="px-5 py-5 text-right font-black italic text-emerald-400 font-mono text-base tracking-tight">
                          {editingId === entry.id ? (
                            <div className="flex items-center justify-end">
                              <div className="relative inline-block">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600 font-bold italic">-R$</span>
                                <input 
                                  type="number" 
                                  className="w-20 sm:w-28 pl-8 pr-1 py-1.5 bg-slate-950 border border-emerald-500/30 rounded-md text-right text-emerald-400 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none font-black italic transition-all shadow-lg shadow-emerald-500/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={editForm.discountValue}
                                  onChange={(e) => setEditForm({ ...editForm, discountValue: Number(e.target.value) })}
                                />
                              </div>
                            </div>
                          ) : (
                            `- ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.discountValue)}`
                          )}
                        </td>
                        <td className="px-5 py-5 text-right text-white font-black italic font-mono text-base shadow-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.balanceAtTime)}
                        </td>
                        <td className="px-5 py-5 text-center">
                          {entry.driveLink ? (
                            <a 
                              href={entry.driveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-black border border-blue-500/20 uppercase tracking-tight shadow-md"
                            >
                              <HardDrive size={14} />
                              Drive
                            </a>
                          ) : entry.pdfBase64 ? (
                            <button 
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black border border-emerald-500/20 uppercase tracking-tight shadow-md"
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
                              <FileText size={14} />
                              Visualizar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-black italic uppercase tracking-widest">Indisponível</span>
                          )}
                        </td>
                        <td className="px-5 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {editingId === entry.id ? (
                               <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                               <button 
                                 onClick={() => handleUpdateEntry(entry.id)}
                                 className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600 transition-all shadow-lg active:scale-95"
                                 title="Salvar"
                               >
                                 <Check size={16} />
                               </button>
                               <button 
                                 onClick={() => setEditingId(null)}
                                 className="bg-slate-700 text-slate-200 p-2 rounded-lg hover:bg-slate-600 transition-all shadow-md active:scale-95"
                                 title="Cancelar"
                               >
                                 <X size={16} />
                               </button>
                             </div>
                            ) : deletingId === entry.id ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                                <button 
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="bg-rose-500 text-white p-2 rounded-lg hover:bg-rose-600 transition-all shadow-lg active:scale-95"
                                  title="Confirmar exclusão"
                                >
                                  <Check size={16} />
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="bg-slate-700 text-slate-200 p-2 rounded-lg hover:bg-slate-600 transition-all shadow-md active:scale-95"
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 opacity-100 group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={() => startEditing(entry)}
                                  className="text-slate-400 hover:text-white hover:bg-slate-800 transition-all p-2 rounded-lg"
                                  title="Editar valores"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button 
                                  onClick={() => setDeletingId(entry.id)}
                                  className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all p-2 rounded-lg"
                                  title="Remover lançamento"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })() : (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-600">
                        <div className="flex flex-col items-center gap-4">
                          <History size={48} className="opacity-10" />
                          <p className="text-sm font-black uppercase italic tracking-[0.2em] opacity-40">Aguardando Lançamentos</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 text-center text-slate-400 text-sm">
        <p>© {new Date().getFullYear()} Sistema de Controle Solar</p>
      </footer>

      {/* Simple Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 animate-in fade-in zoom-in duration-300 border-slate-700 bg-slate-900 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-white uppercase italic tracking-tight">Configurar Investimento</h3>
            <p className="text-sm text-slate-300 mb-8 leading-relaxed">
              Informe o valor bruto total investido no seu sistema fotovoltaico para que possamos calcular o tempo estimado de retorno.
            </p>
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Valor do Projeto (BRL)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold italic">R$</span>
                  <input 
                    type="number" 
                    value={newInvestment}
                    onChange={(e) => setNewInvestment(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-xl text-white font-black italic focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    placeholder="Ex: 14000"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)} className="border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white">Cancelar</Button>
                <Button onClick={handleUpdateSettings} className="bg-emerald-600 hover:bg-emerald-700 px-8">Salvar Alterações</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
