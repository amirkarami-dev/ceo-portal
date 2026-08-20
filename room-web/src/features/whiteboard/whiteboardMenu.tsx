import { MainMenu } from "@excalidraw/excalidraw";

/**
 * The board's menu, chosen item by item.
 *
 * Excalidraw's default menu ends with an «Excalidraw links» group — GitHub, X and Discord — which
 * belong to Excalidraw and not to this organisation's meeting room. There is no prop to hide them:
 * building the menu ourselves is the way they go away, and anything not listed here simply does not
 * render.
 *
 * <b>Returned as an ELEMENT, not wrapped in a component of ours.</b> Excalidraw finds this by
 * checking its children's TYPE for `MainMenu`, so `<WhiteboardMenu />` would hide it behind our own
 * type, Excalidraw would find no menu, and the default one — links and all — would come straight
 * back. That failure is silent, which is why it is written down here.
 *
 * `ToggleTheme` is left out on purpose too: the board already follows the app's light/dark through
 * the `theme` prop, and a second switch inside the canvas would let the two disagree with no way to
 * tell which is right.
 *
 * Every label here comes from Excalidraw's own Persian locale, which the Vite plugin in
 * `vite.config.ts` re-enables — see that file for why it was showing English.
 */
export function whiteboardMenu() {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
}
