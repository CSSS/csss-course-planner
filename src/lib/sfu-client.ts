import {
  JsonHttpClient,
  type JsonHttpClientOptions,
} from "./http-client.ts";
import type {
  AcademicTerm,
  SfuOutlineResponse,
  SfuSection,
  SfuValue,
} from "../types/sfu-api.ts";

const DEFAULT_BASE_URL = "https://www.sfu.ca/bin/wcm/course-outlines";

export type SfuClientOptions = JsonHttpClientOptions & {
  baseUrl?: string;
};

export type CourseOutlineSource = {
  getYears(): Promise<SfuValue[]>;
  getTerms(year: number): Promise<SfuValue[]>;
  getSections(
    term: AcademicTerm,
    department: string,
    courseNumber: string,
  ): Promise<SfuSection[]>;
  getOutline(
    term: AcademicTerm,
    department: string,
    courseNumber: string,
    section: string,
  ): Promise<SfuOutlineResponse>;
};

export class SfuClient implements CourseOutlineSource {
  readonly #baseUrl: string;
  readonly #httpClient: JsonHttpClient;

  constructor(options: SfuClientOptions = {}) {
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.#httpClient = new JsonHttpClient(options);
  }

  async getYears(): Promise<SfuValue[]> {
    return this.#httpClient.getJson<SfuValue[]>(this.#buildUrl());
  }

  async getTerms(year: number): Promise<SfuValue[]> {
    return this.#httpClient.getJson<SfuValue[]>(
      this.#buildUrl(String(year)),
    );
  }

  async getSections(
    term: AcademicTerm,
    department: string,
    courseNumber: string,
  ): Promise<SfuSection[]> {
    return this.#httpClient.getJson<SfuSection[]>(
      this.#buildUrl(
        String(term.year),
        term.semester,
        department.toLowerCase(),
        courseNumber.toLowerCase(),
      ),
    );
  }

  async getOutline(
    term: AcademicTerm,
    department: string,
    courseNumber: string,
    section: string,
  ): Promise<SfuOutlineResponse> {
    return this.#httpClient.getJson<SfuOutlineResponse>(
      this.#buildUrl(
        String(term.year),
        term.semester,
        department.toLowerCase(),
        courseNumber.toLowerCase(),
        section.toLowerCase(),
      ),
    );
  }

  #buildUrl(...segments: string[]): string {
    if (segments.length === 0) {
      return this.#baseUrl;
    }

    return `${this.#baseUrl}?${segments.map(encodeURIComponent).join("/")}`;
  }
}
