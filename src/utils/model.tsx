// model.ts

export type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

export type Slot = {
  id: string;
  day: Day;
  index: number;
  subject: string | null;
};

export type Availability = {
  [day in Day]: boolean[];
};

export type Educator = {
  id: string;
  name: string;
  maxHours: number;
  subjects: string[];
  availability: Availability;
};

export type Assignment = {
  slotId: string;
  educatorId: string;
};