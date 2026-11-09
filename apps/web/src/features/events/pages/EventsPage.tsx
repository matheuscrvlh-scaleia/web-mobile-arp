import { CalendarDays, Globe, List, Tags } from "lucide-react";
import { useAuth } from "@/shared/auth";
import { EVENTS_TABS, type EventsTab, PATHS } from "@/shared/config/paths";
import { useSearchParamOption } from "@/shared/hooks";
import { ButtonLink, Can, PageHeader, type TabItem, TabPanel, Tabs } from "@/shared/ui";
import { EventsCalendar } from "../components/calendar/EventsCalendar";
import { EventCategoriesTab } from "../components/EventCategoriesTab";
import { EventsListTab } from "../components/EventsListTab";

const TAB_ITEMS: TabItem<EventsTab>[] = [
  { value: "lista", label: "Lista", icon: List },
  { value: "calendario", label: "Calendário", icon: CalendarDays },
  { value: "categorias", label: "Categorias", icon: Tags },
];

export function EventsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useSearchParamOption("aba", EVENTS_TABS, "lista");

  return (
    <>
      <PageHeader
        title="Eventos"
        description="A agenda vem do site da ARP: aqui você só escolhe o que aparece no app."
        actions={
          <Can permission="events.manage">
            <ButtonLink to={PATHS.integrations} variant="secondary" icon={Globe}>
              Sincronizar com o site
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
        {tab === "calendario" && <EventsCalendar />}
        {tab === "categorias" && <EventCategoriesTab canEdit={can("events.manage")} />}
      </TabPanel>
    </>
  );
}
