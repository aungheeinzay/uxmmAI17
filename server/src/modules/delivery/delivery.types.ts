export type DeliveryServiceOffering = {
  id: string;
  name: string;
  city: string;
  fee: string;
  currency: string;
};

export type DeliveryServiceCatalog = {
  city: string;
  services: DeliveryServiceOffering[];
};

export type DeliveryCityList = {
  cities: string[];
};
