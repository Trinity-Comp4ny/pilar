import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./sidebar";

const h = vi.hoisted(() => ({ isMobile: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.isMobile }));

function Estado() {
  const { state, openMobile } = useSidebar();
  return (
    <span data-testid="estado">
      {state}/{String(openMobile)}
    </span>
  );
}

function Arvore({ collapsible }: { collapsible?: "offcanvas" | "icon" | "none" }) {
  return (
    <>
      <Sidebar collapsible={collapsible} variant="floating" side="right">
        <SidebarHeader>cabeçalho</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Grupo</SidebarGroupLabel>
            <SidebarGroupLabel asChild>
              <h3>Grupo como h3</h3>
            </SidebarGroupLabel>
            <SidebarGroupAction title="Ação do grupo" />
            <SidebarGroupAction asChild>
              <a href="#g">ação link</a>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarInput placeholder="filtrar" />
              <SidebarSeparator />
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Dica">
                    Item
                  </SidebarMenuButton>
                  <SidebarMenuButton tooltip={{ children: "Dica objeto" }} size="sm" variant="outline">
                    Item 2
                  </SidebarMenuButton>
                  <SidebarMenuButton asChild>
                    <a href="#x">Item link</a>
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover title="Mais" />
                  <SidebarMenuAction asChild>
                    <a href="#y">ação</a>
                  </SidebarMenuAction>
                  <SidebarMenuBadge>3</SidebarMenuBadge>
                  <SidebarMenuSkeleton showIcon />
                  <SidebarMenuSkeleton />
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton href="#s" isActive size="sm">
                        Sub
                      </SidebarMenuSubButton>
                      <SidebarMenuSubButton asChild>
                        <button type="button">Sub botão</button>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>rodapé</SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
        <Estado />
      </SidebarInset>
    </>
  );
}

beforeEach(() => {
  h.isMobile = false;
  document.cookie = "sidebar:state=; max-age=0; path=/";
});

describe("ui/sidebar", () => {
  it("useSidebar fora do provider falha", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Estado />)).toThrow(/SidebarProvider/);
    vi.restoreAllMocks();
  });

  it("desktop: trigger, rail e atalho ⌘B alternam e gravam o cookie", async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <Arvore />
      </SidebarProvider>
    );
    expect(screen.getByText("cabeçalho")).toBeInTheDocument();
    expect(screen.getByTestId("estado")).toHaveTextContent("expanded/false");

    await user.click(screen.getByRole("button", { name: "Alternar menu lateral", description: "" }));
    expect(screen.getByTestId("estado")).toHaveTextContent("collapsed");
    expect(document.cookie).toContain("sidebar:state=false");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.getByTestId("estado")).toHaveTextContent("expanded");
    fireEvent.keyDown(window, { key: "b" });
    expect(screen.getByTestId("estado")).toHaveTextContent("expanded");

    await user.click(screen.getByTitle("Alternar menu lateral"));
    expect(screen.getByTestId("estado")).toHaveTextContent("collapsed");
  });

  it("controlado de fora chama onOpenChange", async () => {
    const onOpenChange = vi.fn();
    render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <Arvore collapsible="icon" />
      </SidebarProvider>
    );
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("estado")).toHaveTextContent("collapsed");
  });

  it("collapsible none renderiza fixo", () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <Arvore collapsible="none" />
      </SidebarProvider>
    );
    expect(screen.getByText("rodapé")).toBeInTheDocument();
  });

  it("mobile vira sheet aberto pelo trigger", async () => {
    h.isMobile = true;
    const user = userEvent.setup();
    render(
      <SidebarProvider>
        <Arvore />
      </SidebarProvider>
    );
    expect(screen.queryByText("cabeçalho")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Alternar menu lateral" }));
    expect(screen.getByTestId("estado")).toHaveTextContent("expanded/true");
    expect(await screen.findByText("cabeçalho")).toBeInTheDocument();
  });
});
