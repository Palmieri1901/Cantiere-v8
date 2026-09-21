import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Truck } from "lucide-react";
import DdtTab from "@/pages/ddt/DdtTab";
import RubricaTab from "@/pages/ddt/RubricaTab";

export default function Ddt() {
  const [indirizzi, setIndirizzi] = useState([]);
  const loadRubrica = async () => { try { setIndirizzi((await api.get("/ddt/indirizzi")).data); } catch { /* toast in tab */ } };
  useEffect(() => { loadRubrica(); }, []);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto" data-testid="page-ddt">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <Truck className="w-6 h-6" strokeWidth={1.8} />
        </div>
        <div>
          <div className="label-mini mb-0.5">Trasporti</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">DDT & Foglio di destinazione</h1>
        </div>
      </div>
      <Tabs defaultValue="ddt" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="ddt" data-testid="tab-ddt">Documenti di trasporto</TabsTrigger>
          <TabsTrigger value="rubrica" data-testid="tab-rubrica">Rubrica indirizzi</TabsTrigger>
        </TabsList>
        <TabsContent value="ddt"><DdtTab indirizzi={indirizzi} onReloadRubrica={loadRubrica} /></TabsContent>
        <TabsContent value="rubrica"><RubricaTab indirizzi={indirizzi} onReload={loadRubrica} /></TabsContent>
      </Tabs>
    </div>
  );
}
