import { Award, LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParamOption } from "@/shared/hooks";
import { Button, Can, PageHeader, type TabItem, TabPanel, Tabs } from "@/shared/ui";
import { EarnedSealsPanel } from "../components/EarnedSealsPanel";
import { SealGallery } from "../components/SealGallery";

type SealsTab = "galeria" | "conquistados";
const TABS: readonly SealsTab[] = ["galeria", "conquistados"];
const TAB_ITEMS: TabItem<SealsTab>[] = [
  { value: "galeria", label: "Coleção", icon: LayoutGrid },
  { value: "conquistados", label: "Conquistados", icon: Award },
];

export function SealsPage() {
  const [tab, setTab] = useSearchParamOption("aba", TABS, "galeria");
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="Selos"
        description="A coleção de selos do app e quem já conquistou cada um."
        actions={
          tab === "galeria" && (
            <Can permission="challenges.manage">
              <Button icon={Plus} onClick={() => setCreating(true)}>
                Novo selo
              </Button>
            </Can>
          )
        }
      />
      <Tabs
        idBase="selos"
        label="Seções dos selos"
        items={TAB_ITEMS}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="selos" value={tab}>
        {tab === "galeria" ? (
          <SealGallery
            creating={creating}
            onCreate={() => setCreating(true)}
            onCreateClose={() => setCreating(false)}
          />
        ) : (
          <EarnedSealsPanel />
        )}
      </TabPanel>
    </>
  );
}
