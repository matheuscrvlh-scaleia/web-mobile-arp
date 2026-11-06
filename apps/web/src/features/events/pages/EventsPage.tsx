import { CalendarDays, Globe, List, Plus, Tags } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/shared/auth";
import { EVENTS_TABS, type EventsTab, PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import { Button, ButtonLink, Can, PageHeader, type TabItem, TabPanel, Tabs } from "@/shared/ui";
import { EventsCalendar } from "../components/calendar/EventsCalendar";
import { EventCategoriesTab } from "../components/EventCategoriesTab";
import { EventsListTab } from "../components/EventsListTab";
import { ImportSiteEventsModal } from "../components/ImportSiteEventsModal";

const TAB_ITEMS: TabItem<EventsTab>[] = [
  { value: "lista", label: "Lista", icon: List },
  { value: "calendario", label: "Calendário", icon: CalendarDays },
  { value: "categorias", label: "Categorias", icon: Tags },
];

export function EventsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useSearchParamOption("aba", EVENTS_TABS, "lista");
  const [importing, setImporting] = useState(false);

  return (
    <>
      <PageHeader
        title="Eventos"
        description="A agenda do app: eventos de um dia, de um período (até o mês inteiro) ou semanais."
        actions={
          <Can permission="events.manage">
            <Button variant="secondary" icon={Globe} onClick={() => setImporting(true)}>
              Importar do site
            </Button>
            <ButtonLink to={PATHS.eventNew} icon={Plus}>
              Novo evento
            </ButtonLink>
          </Can>
        }
      />
      <Tabs
        idBase="eventos"
        label="Visões da agenda"
        items={TAB_ITEMS}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      <TabPanel idBase="eventos" value={tab}>
        {tab === "lista" && <EventsListTab />}
        {tab === "calendario" && <EventsCalendar canCreate={can("events.manage")} />}
        {tab === "categorias" && <EventCategoriesTab canEdit={can("events.manage")} />}
      </TabPanel>
      <ImportSiteEventsModal open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
