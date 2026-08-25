export type DonationOfferPublication =
  | {
      status: "placeholder";
      version: null;
    }
  | {
      status: "published";
      version: string;
      title: string;
      sections: readonly {
        heading: string;
        paragraphs: readonly string[];
      }[];
    };

export const donationOfferPublication: DonationOfferPublication = {
  status: "placeholder",
  version: null,
};
