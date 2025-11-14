import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Sparkles, Loader2, MessageSquare } from "lucide-react";
import { useContractAssistant } from "@/hooks/useContractAssistant";

interface ContractAIContextProps {
  contractId: string;
  contractCode: string;
}

export const ContractAIContext = ({ contractId, contractCode }: ContractAIContextProps) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, isLoading } = useContractAssistant(contractId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input.trim();
    setInput("");
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleProactiveAnalysis = async () => {
    const proactivePrompt = `Analiza este contrato y proporciona:
1. Un resumen ejecutivo de 3-4 puntos clave
2. Riesgos o alertas principales detectadas
3. Oportunidades de mejora u optimización`;
    
    await sendMessage(proactivePrompt);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Asistente IA de Contratos</CardTitle>
            </div>
            <Badge variant="outline" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              {messages.length} mensajes
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pregúntame cualquier cosa sobre el contrato <strong>{contractCode}</strong>. 
            Tengo acceso completo al resumen ejecutivo y puedo explicarte cualquier aspecto en detalle.
          </p>
          
          {messages.length === 0 && (
            <Button 
              onClick={handleProactiveAnalysis}
              variant="outline"
              className="w-full gap-2"
              disabled={isLoading}
            >
              <Sparkles className="h-4 w-4" />
              Generar análisis proactivo
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conversación</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 p-0">
          <ScrollArea ref={scrollRef} className="flex-1 px-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-2">
                  No hay mensajes aún
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  Prueba preguntando: "¿De qué trata este contrato?", "¿Cuáles son los entregables principales?" 
                  o "¿Hay riesgos identificados?"
                </p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Pensando...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="px-6 pb-6">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta sobre el contrato..."
                className="min-h-[60px] resize-none"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSend} 
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[60px] w-[60px] shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage("¿De qué trata este contrato?")}
                  disabled={isLoading}
                  className="text-xs"
                >
                  ¿De qué trata?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage("¿Cuáles son los entregables principales?")}
                  disabled={isLoading}
                  className="text-xs"
                >
                  Entregables
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage("¿Hay riesgos identificados?")}
                  disabled={isLoading}
                  className="text-xs"
                >
                  Riesgos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage("¿Cuál es el equipo del proyecto?")}
                  disabled={isLoading}
                  className="text-xs"
                >
                  Equipo
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
