declare module "virtual:meli-pu-description-ledger" {
  const ledger: ReadonlyArray<{
    group: string;
    name: string;
    sl: string;
    en: string;
    de: string;
    it: string;
  }>;
  export default ledger;
}