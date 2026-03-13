import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface TokenResult {
  token: string;
  preview: string;
  status: string;
  message: string;
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [oauthUrl, setOauthUrl] = useState("");
  const [manualTokens, setManualTokens] = useState("");
  const [uploadedTokens, setUploadedTokens] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<TokenResult[]>([]);
  const [urlError, setUrlError] = useState("");
  const [activeTab, setActiveTab] = useState("manual");

  const processTokensMutation = trpc.oauth2.processTokens.useMutation();
  const getHistoryQuery = trpc.oauth2.getHistory.useQuery();

  const handleValidateUrl = async () => {
    if (!oauthUrl.trim()) {
      setUrlError("Cole o link OAuth2");
      return;
    }

    try {
      setUrlError("");
      const url = new URL(oauthUrl);
      const params = Object.fromEntries(url.searchParams);
      
      if (!params.client_id || !params.redirect_uri || !params.scope) {
        setUrlError("URL OAuth2 incompleta. Faltam parametros obrigatorios");
        return;
      }
      
      toast.success("URL OAuth2 valida!");
    } catch (error: any) {
      setUrlError("URL invalida");
      toast.error("URL invalida");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const tokens = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      setUploadedTokens(tokens);
      toast.success(`${tokens.length} tokens carregados`);
    };
    reader.readAsText(file);
  };

  const handleProcessTokens = async () => {
    if (!oauthUrl.trim()) {
      setUrlError("Cole o link OAuth2");
      return;
    }

    const tokensToProcess =
      activeTab === "manual"
        ? manualTokens
            .split("\n")
            .map((t) => t.trim())
            .filter((t) => t && !t.startsWith("#"))
        : uploadedTokens;

    if (tokensToProcess.length === 0) {
      toast.error("Nenhum token para processar");
      return;
    }

    setProcessing(true);
    setResults([]);

    try {
      const response = await processTokensMutation.mutateAsync({
        tokens: tokensToProcess,
        oauthUrl,
      });

      setResults(response.results);
      toast.success(
        `Processamento concluido: ${response.successCount} sucesso, ${response.errorCount} erros`
      );
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar tokens");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">OAuth2 Smart Authorizer</h1>
          <p className="text-muted-foreground">
            Processe tokens Discord com autorizacao automatica
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-6 mb-6">
          {/* OAuth URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Link de Autorizacao OAuth2
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="https://discord.com/api/oauth2/authorize?..."
                value={oauthUrl}
                onChange={(e) => {
                  setOauthUrl(e.target.value);
                  setUrlError("");
                }}
                disabled={processing}
                className="flex-1"
              />
              <Button
                onClick={handleValidateUrl}
                variant="outline"
                disabled={processing || !oauthUrl.trim()}
              >
                Validar
              </Button>
            </div>
            {urlError && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{urlError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Tabs for Token Input */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Inserir Manualmente</TabsTrigger>
              <TabsTrigger value="file">Importar Arquivo</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tokens Discord (um por linha)
                </label>
                <Textarea
                  placeholder="Cole os tokens aqui, um por linha&#10;Linhas comecando com # serao ignoradas"
                  value={manualTokens}
                  onChange={(e) => setManualTokens(e.target.value)}
                  disabled={processing}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {manualTokens
                    .split("\n")
                    .filter((t) => t.trim() && !t.trim().startsWith("#")).length}{" "}
                  tokens validos
                </p>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-card/50 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium mb-1">Clique para selecionar arquivo</p>
                <p className="text-sm text-muted-foreground">
                  Arquivo .txt com tokens (um por linha)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              {uploadedTokens.length > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    {uploadedTokens.length} tokens carregados do arquivo
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          {/* Process Button */}
          <Button
            onClick={handleProcessTokens}
            disabled={processing || !oauthUrl.trim()}
            size="lg"
            className="w-full"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Processar Tokens"
            )}
          </Button>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Resultados</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {result.status === "success" && (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                    {result.status === "error" && (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    {result.status === "captcha_required" && (
                      <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm truncate">{result.preview}</p>
                      <p className="text-xs text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      result.status === "success"
                        ? "default"
                        : result.status === "error"
                          ? "destructive"
                          : "secondary"
                    }
                    className="flex-shrink-0 ml-2"
                  >
                    {result.status === "success" && "✓ Sucesso"}
                    {result.status === "error" && "✗ Erro"}
                    {result.status === "captcha_required" && "⏳ Captcha"}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">
                  {results.filter((r) => r.status === "success").length}
                </p>
                <p className="text-sm text-muted-foreground">Sucessos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">
                  {results.filter((r) => r.status === "error").length}
                </p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">
                  {results.filter((r) => r.status === "captcha_required").length}
                </p>
                <p className="text-sm text-muted-foreground">Captcha</p>
              </div>
            </div>
          </Card>
        )}

        {/* History */}
        {getHistoryQuery.data && getHistoryQuery.data.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Historico Recente</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {getHistoryQuery.data.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    {item.status === "success" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {item.status === "error" && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    {item.status === "captcha_required" && (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-mono text-sm">{item.tokenPreview}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === "success"
                        ? "default"
                        : item.status === "error"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
