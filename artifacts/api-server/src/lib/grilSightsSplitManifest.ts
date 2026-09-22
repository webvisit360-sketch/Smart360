export type AlignmentTargetKey = "act" | "culinary" | "culture" | "hosp" | "nature" | "pharm";

export type ItemCategoryRekeyRule = {
  id: string;
  expectedTitle: string;
  sourceKey: "sights";
  targetKey: AlignmentTargetKey;
};

export type ProposalCategoryRekeyRule = {
  id: string;
  expectedName: string;
  sourceKey: "food" | "health" | "sights";
  targetKey: AlignmentTargetKey;
};

export type SightsSplitRules = {
  itemRules: readonly ItemCategoryRekeyRule[];
  proposalRules: readonly ProposalCategoryRekeyRule[];
};

/**
 * Owner-approved, stable-ID ledger for Glamping Gril's legacy Znamenitosti
 * split. This is deliberately data, not name-based classification logic.
 */
export const GRIL_SIGHTS_SPLIT: SightsSplitRules = {
  itemRules: [
    { id: "45090937-2e12-48d3-87a9-f1179f2f5e2c", expectedTitle: "Center Rinka", sourceKey: "sights", targetKey: "culture" },
    { id: "d6ba8374-c11d-43b1-ace8-ba647dd2651b", expectedTitle: "Cerkev sv. Frančiška Ksaverija", sourceKey: "sights", targetKey: "culture" },
    { id: "603fda63-f4fc-4e53-8f0f-7eb977aeccf9", expectedTitle: "Flosarski muzej Ljubno ob Savinji", sourceKey: "sights", targetKey: "culture" },
    { id: "42399814-ec16-4994-9048-0cf7908f2016", expectedTitle: "Grad Žovnek", sourceKey: "sights", targetKey: "culture" },
    { id: "b86fc640-92e4-4014-aada-8baa487b1311", expectedTitle: "Izvir Savinje", sourceKey: "sights", targetKey: "nature" },
    { id: "097f6a52-0170-4e35-bede-c1724c92dd0e", expectedTitle: "Jama Pekel", sourceKey: "sights", targetKey: "nature" },
    { id: "98b050d9-ef6c-4613-b053-707725017055", expectedTitle: "Matkov škaf", sourceKey: "sights", targetKey: "nature" },
    { id: "fd9d941b-f143-4804-a865-38aed37df836", expectedTitle: "Mozirski gaj", sourceKey: "sights", targetKey: "nature" },
    { id: "c45a1ac0-c214-4e6f-9c5d-78f56e50ae90", expectedTitle: "Muzej premogovništva Slovenije", sourceKey: "sights", targetKey: "culture" },
    { id: "ecdf8726-e0a8-4f27-bb0e-d327444f07cc", expectedTitle: "Potočka zijalka", sourceKey: "sights", targetKey: "nature" },
    { id: "8f7b1ffa-7b13-441b-a7ba-a7dbc8a6bb88", expectedTitle: "Slap Rinka", sourceKey: "sights", targetKey: "nature" },
    { id: "e0671a2b-1db4-4dfc-8584-176e951e1a0d", expectedTitle: "Snežna jama", sourceKey: "sights", targetKey: "nature" },
    { id: "e9fae122-8743-4de6-aec9-0fa346d61938", expectedTitle: "Velenjski grad", sourceKey: "sights", targetKey: "culture" },
    { id: "3ac0cb9d-34ca-4f49-ab87-3c3f36a09270", expectedTitle: "Žovneško jezero", sourceKey: "sights", targetKey: "nature" },
  ],
  proposalRules: [
    { id: "0f6c6323-863d-47db-99d6-52a7c8964d6c", expectedName: "Alpski vrt Golte", sourceKey: "sights", targetKey: "nature" },
    { id: "2fe45650-3910-47e2-9ba5-5f6edfa0cb6d", expectedName: "Celjski grad", sourceKey: "sights", targetKey: "culture" },
    { id: "b90285f6-f5ee-48aa-8233-5da617fa192d", expectedName: "Center Rinka", sourceKey: "sights", targetKey: "culture" },
    { id: "97bb7d91-7a8a-44c5-9cbc-4a9b587d1be0", expectedName: "Cerkev Marije Snežne", sourceKey: "sights", targetKey: "culture" },
    { id: "10e87218-bf17-43ee-b194-2b57ddc509ab", expectedName: "Cerkev Marijinega rojstva", sourceKey: "sights", targetKey: "culture" },
    { id: "c30e8559-7005-4240-9750-948211e78ef7", expectedName: "Cerkev sv. Elizabete", sourceKey: "sights", targetKey: "culture" },
    { id: "c7c12149-ae50-44c6-b867-e396bd62fad4", expectedName: "Cerkev sv. Elizabete", sourceKey: "sights", targetKey: "culture" },
    { id: "f7dbcb0a-46f5-4cf3-aedd-193343417b78", expectedName: "Cerkev sv. Frančiška Ksaverija", sourceKey: "sights", targetKey: "culture" },
    { id: "1c22eb54-5031-42fa-888b-b2c3a3745dc3", expectedName: "Cerkev sv. Frančiška Ksaverija", sourceKey: "sights", targetKey: "culture" },
    { id: "92be2f51-0c56-4f7b-849c-9de50f90f951", expectedName: "Cerkev sv. Jakoba", sourceKey: "sights", targetKey: "culture" },
    { id: "204ea70c-1051-44c8-a125-267e79bf0c85", expectedName: "Cerkev sv. Križa", sourceKey: "sights", targetKey: "culture" },
    { id: "856d086d-3525-4b7f-a9f1-abf329a04bb6", expectedName: "Cerkev sv. Primoža in Felicijana", sourceKey: "sights", targetKey: "culture" },
    { id: "7417bf67-8127-4c23-aa73-2a0c83083773", expectedName: "Cerkev sv. Primoža in Felicijana", sourceKey: "sights", targetKey: "culture" },
    { id: "2456105f-341c-4650-92f7-35a3a2643eaf", expectedName: "Cerkev sv. Roka", sourceKey: "sights", targetKey: "culture" },
    { id: "2279c4a5-92b9-4c2b-9834-b950634a327f", expectedName: "Dvorec Novo Celje", sourceKey: "sights", targetKey: "culture" },
    { id: "e3ae9924-b7fb-4692-b45b-80b87ff3657d", expectedName: "Flosarski muzej Ljubno ob Savinji", sourceKey: "sights", targetKey: "culture" },
    { id: "fbaf71ed-c6bb-48d2-8a56-f1d4551f7b76", expectedName: "Fužinarski most", sourceKey: "sights", targetKey: "culture" },
    { id: "dd49cfbf-ab8d-4fb6-870a-c17e19dfc8be", expectedName: "Grad Forhtenek", sourceKey: "sights", targetKey: "culture" },
    { id: "21df0de9-9bbe-48f5-bbac-d03ccb22406a", expectedName: "Grad Vrbovec", sourceKey: "sights", targetKey: "culture" },
    { id: "66fa9d60-aa7f-4f1f-a72c-b52362b8aa52", expectedName: "Grad Vrbovec", sourceKey: "sights", targetKey: "culture" },
    { id: "120f0a0b-f95d-4309-9124-2abb4956c8ac", expectedName: "Grad Žovnek", sourceKey: "sights", targetKey: "culture" },
    { id: "929d3884-4fb8-4df1-8d6f-e6a40bd2a7c6", expectedName: "Izvir Savinje", sourceKey: "sights", targetKey: "nature" },
    { id: "e7849b26-2b1c-442e-b40a-ff1f9b760add", expectedName: "Jama Huda luknja", sourceKey: "sights", targetKey: "nature" },
    { id: "422eec61-33b5-4830-b38c-1e885fd32564", expectedName: "Jama Pekel", sourceKey: "sights", targetKey: "nature" },
    { id: "78c6c2d3-c6ad-4180-8009-053a72e2437f", expectedName: "Jezero na Golteh", sourceKey: "sights", targetKey: "nature" },
    { id: "e7eecab5-f6c0-4957-9ba8-e9ace325cb80", expectedName: "Kapela sv. Ane", sourceKey: "sights", targetKey: "culture" },
    { id: "4008e2a1-8cec-44b6-9b18-ab156a40a8ac", expectedName: "Kmetija Bukovnik", sourceKey: "sights", targetKey: "culinary" },
    { id: "11adb6a3-5c8b-44a3-9013-d918d83bbd3a", expectedName: "Ledenica na Golteh", sourceKey: "sights", targetKey: "nature" },
    { id: "6be6ae15-a2a0-4cfb-b04e-f1f6ddd670ab", expectedName: "Ljubenski most", sourceKey: "sights", targetKey: "culture" },
    { id: "22edd549-8691-4652-b2ba-5246cb9ca631", expectedName: "Matkov škaf", sourceKey: "sights", targetKey: "nature" },
    { id: "595eb3a3-be4f-4f6e-b75f-4bba8a409c49", expectedName: "Mozirski gaj", sourceKey: "sights", targetKey: "nature" },
    { id: "4a36c74b-2e5e-4eac-a3d6-9e2a81cff224", expectedName: "Muzej gozdarstva in lesarstva Nazarje", sourceKey: "sights", targetKey: "culture" },
    { id: "1ccee439-5b27-4174-9b7a-ce270a95e43a", expectedName: "Muzej gozdarstva in lesarstva Nazarje", sourceKey: "sights", targetKey: "culture" },
    { id: "fbf3c042-c81b-4832-b1fa-f6cea211debb", expectedName: "Muzej premogovništva Slovenije", sourceKey: "sights", targetKey: "culture" },
    { id: "e192e0d6-ed5c-41f8-a77f-fe3c45b8fac1", expectedName: "Podzemlje Pece", sourceKey: "sights", targetKey: "nature" },
    { id: "5f003916-5b83-4641-8896-cbcb728e1be1", expectedName: "Pokrajinski muzej Celje", sourceKey: "sights", targetKey: "culture" },
    { id: "a1bb6854-c144-428b-a666-0c8444a9c5c5", expectedName: "Potočka zijalka", sourceKey: "sights", targetKey: "nature" },
    { id: "df543171-7c0f-4e82-9df9-d4a51f6778d7", expectedName: "Razgledni stolp na Golteh", sourceKey: "sights", targetKey: "act" },
    { id: "99caf2e1-8518-4ea3-b064-39e784d40217", expectedName: "Rimska nekropola v Šempetru", sourceKey: "sights", targetKey: "culture" },
    { id: "230db712-8553-4d80-ad8f-57ec42251aad", expectedName: "Rimska nekropola v Šempetru", sourceKey: "sights", targetKey: "culture" },
    { id: "c80fe42a-a68e-421a-8eec-660e68e8181c", expectedName: "Romarska cerkev Marije Snežne", sourceKey: "sights", targetKey: "culture" },
    { id: "940b251d-bec2-4411-811c-a4c8426f2c02", expectedName: "Samostan Nazarje", sourceKey: "sights", targetKey: "culture" },
    { id: "b53cbdce-c596-41bc-b743-cf6401a460e6", expectedName: "Samostan Nazarje", sourceKey: "sights", targetKey: "culture" },
    { id: "050d3d19-b9ee-47c3-9640-d89640a80512", expectedName: "Slap Brložnica", sourceKey: "sights", targetKey: "nature" },
    { id: "998ea7ee-3cc6-4f7f-a345-49378d64ddb0", expectedName: "Slap Brložnica", sourceKey: "sights", targetKey: "nature" },
    { id: "7e731b67-d3b4-4c3c-9459-f65f962bcbc0", expectedName: "Slap Kovač", sourceKey: "sights", targetKey: "nature" },
    { id: "b1867281-f7c7-4ac0-900d-610875218dac", expectedName: "Slap Orglice", sourceKey: "sights", targetKey: "nature" },
    { id: "680a40f5-a31f-46cb-8435-940faf87775b", expectedName: "Slap Palenk", sourceKey: "sights", targetKey: "nature" },
    { id: "d6a51991-178c-4e17-a00f-2a2bafb01fbe", expectedName: "Slap Palenk", sourceKey: "sights", targetKey: "nature" },
    { id: "352e5532-d337-48f3-87c0-e8e53386c12f", expectedName: "Slap Rinka", sourceKey: "sights", targetKey: "nature" },
    { id: "74206ae9-44e8-4d2c-99af-0548455a0bb5", expectedName: "Slap Trbiž", sourceKey: "sights", targetKey: "nature" },
    { id: "0f9312e9-32e3-4f01-b59c-381afbba1e5b", expectedName: "Slap Virje", sourceKey: "sights", targetKey: "nature" },
    { id: "71c74962-2202-460b-a3c1-a53cb54c48b1", expectedName: "Slap Virje", sourceKey: "sights", targetKey: "nature" },
    { id: "358914a7-cfab-4da9-9546-1610f10d620e", expectedName: "Slap Žep", sourceKey: "sights", targetKey: "nature" },
    { id: "ba217862-fc8b-4b7e-b1ee-6fe6733f848c", expectedName: "Slap Žep", sourceKey: "sights", targetKey: "nature" },
    { id: "17ba6d94-53b0-4ebc-8cff-cd302404c757", expectedName: "Snežna jama", sourceKey: "sights", targetKey: "nature" },
    { id: "f61ddae2-31c2-4798-8375-cdd5223c2bbc", expectedName: "Solčavski macesen", sourceKey: "sights", targetKey: "nature" },
    { id: "ec04f100-8bb8-48b0-93e3-2b21b0be192b", expectedName: "Stari grad Celje", sourceKey: "sights", targetKey: "culture" },
    { id: "aac4b44f-93bf-4e66-9aa1-d8af8e14367f", expectedName: "Velenjski grad", sourceKey: "sights", targetKey: "culture" },
    { id: "b139a2ef-36ba-443f-949c-ccbdfd5d2a15", expectedName: "Čebelarski muzej Ljubno", sourceKey: "sights", targetKey: "culture" },
    { id: "838ac0bc-f483-4359-ab48-f42dd82245f6", expectedName: "Žička kartuzija", sourceKey: "sights", targetKey: "culture" },
    { id: "f810755e-eb9a-4110-a279-7e0fc120cfa5", expectedName: "Žovneško jezero", sourceKey: "sights", targetKey: "nature" },
    { id: "40fedef4-88c4-4c4f-a684-7c399d242b24", expectedName: "Župnijska cerkev sv. Mohorja in Fortunata", sourceKey: "sights", targetKey: "culture" },
  ],
};