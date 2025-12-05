export interface SermonInfo {
  department: string;
  customDepartment: string;
  contentType: string;
  contentDetail: string;
  frequency: string;
  customFrequency: string;
  theme: string; // Additional general theme or focus
  scriptureReference?: string;
}

export interface FileData {
  data: string; // base64 encoded string
  mimeType: string;
  name: string;
}