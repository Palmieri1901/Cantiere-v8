import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ship } from "lucide-react";
import ModelliTab from "@/pages/suzuki/ModelliTab";
import PreventiviTab from "@/pages/suzuki/PreventiviTab";
import LegendaTab from "@/pages/suzuki/LegendaTab";

export default function Suzuki() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto" data-testid="page-suzuki">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <Ship className="w-6 h-6" strokeWidth={1.8} />
        </div>
        <div>
          <div className="label-mini mb-0.5">Fuoribordo</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Suzuki</h1>
        </div>
      </div>

      <Tabs defaultValue="modelli" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="modelli" data-testid="tab-modelli">Modelli & Listino</TabsTrigger>
          <TabsTrigger value="preventivi" data-testid="tab-preventivi">Preventivi</TabsTrigger>
          <TabsTrigger value="legenda" data-testid="tab-legenda">Legenda sigle</TabsTrigger>
        </TabsList>

        <TabsContent value="modelli"><ModelliTab /></TabsContent>
        <TabsContent value="preventivi"><PreventiviTab /></TabsContent>
        <TabsContent value="legenda"><LegendaTab /></TabsContent>
      </Tabs>
    </div>
  );
}
