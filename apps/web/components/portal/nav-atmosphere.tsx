/** Camada decorativa: bolhas desfocadas / sintilantes com a cor do tema. */

type Props = {
  /**
   * `shell` - cobre o portal inteiro (nav + header + view) com mais orbs.
   * `nav` - versão mais densa para a sidebar (legado / reforço).
   */
  variant?: "shell" | "nav";
  className?: string;
};

export function NavAtmosphere({ variant = "nav", className }: Props) {
  const shell = variant === "shell";
  return (
    <div
      className={["ui-nav-atmosphere", shell ? "ui-shell-atmosphere" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <span className="ui-nav-orb ui-nav-orb-a" />
      <span className="ui-nav-orb ui-nav-orb-b" />
      <span className="ui-nav-orb ui-nav-orb-c" />
      <span className="ui-nav-orb ui-nav-orb-d" />
      <span className="ui-nav-orb ui-nav-orb-e" />
      {shell ? (
        <>
          <span className="ui-nav-orb ui-nav-orb-f" />
          <span className="ui-nav-orb ui-nav-orb-g" />
          <span className="ui-nav-orb ui-nav-orb-h" />
          <span className="ui-nav-orb ui-nav-orb-i" />
          <span className="ui-nav-orb ui-nav-orb-j" />
        </>
      ) : null}
    </div>
  );
}
