import type { HandlerResponse } from '../../shared/types';
import type {
  ExtractData,
  FileMetaResponse,
  FileSectionResponse,
  FileStructureResponse,
  FileTailResponse,
} from '@mdplane/shared';

export type FileReadError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type SectionData = {
  ok: true;
  data: ExtractData<FileSectionResponse>;
};

export type MetaData = {
  ok: true;
  data: ExtractData<FileMetaResponse>;
};

export type StructureData = {
  ok: true;
  data: ExtractData<FileStructureResponse>;
};

export type TailData = {
  ok: true;
  data: ExtractData<FileTailResponse>;
};

export type ReadSectionResult = HandlerResponse<SectionData | FileReadError>;
export type ReadMetaResult = HandlerResponse<MetaData | FileReadError>;
export type ReadRawResult = HandlerResponse<string | FileReadError>;
export type ReadStructureResult = HandlerResponse<StructureData | FileReadError>;
export type ReadTailResult = HandlerResponse<TailData | FileReadError>;
