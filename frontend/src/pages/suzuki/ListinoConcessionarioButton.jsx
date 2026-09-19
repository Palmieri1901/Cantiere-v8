import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import ListinoConcessionarioEditor from "./ListinoConcessionarioEditor";

export default function ListinoConcessionarioButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
        data-testid="btn-pdf-listino-conc"
      >
        <FileText className="w-4 h-4 mr-2" /> Listino concessionario
      </Button>
      <ListinoConcessionarioEditor open={open} onClose={() => setOpen(false)} />
    </>
  );
}
