import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LifeBuoy } from "lucide-react";
import CatalogoTab from "@/pages/gommoni/CatalogoTab";
import AccessoriTab from "@/pages/gommoni/AccessoriTab";
import PreventiviGommoniTab from "@/pages/gommoni/PreventiviGommoniTab";

export default function Gommoni() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto" data-testid="page-gommoni">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <LifeBuoy className="w-6 h-6" strokeWidth={1.8} />
        </div>
        <div>
          <div className="label-mini mb-0.5">Gommoni nuovi</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Gommoni GEB</h1>
        </div>
      </div>
      <Tabs defaultValue="catalogo" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="catalogo" data-testid="tab-gommoni-catalogo">Catalogo & Listini</TabsTrigger>
          <TabsTrigger value="accessori" data-testid="tab-gommoni-accessori">Accessori optional</TabsTrigger>
          <TabsTrigger value="preventivi" data-testid="tab-gommoni-preventivi">Preventivi</TabsTrigger>
        </TabsList>
        <TabsContent value="catalogo"><CatalogoTab /></TabsContent>
        <TabsContent value="accessori"><AccessoriTab /></TabsContent>
        <TabsContent value="preventivi"><PreventiviGommoniTab /></TabsContent>
      </Tabs>
    </div>
  );
}
