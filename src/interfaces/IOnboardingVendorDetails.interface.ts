export interface IVendorLanguageOnFile {
    language?: string;
    code?: string;
    proficiency?: string;
    direction?: string;
    certified?: boolean;
    certification?: string;
}

export interface IVendorVehicleOnFile {
    hasVehicle?: boolean;
    type?: string;
    licenseState?: string;
    licenseExpiresOn?: string;
    insured?: boolean;
    willingToTravelMiles?: number;
}

export interface IVendorResumeOnFile {
    fileKey?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    checksumSha256?: string;
    uploadedOn?: string;
    parseStatus?: string;
    parseError?: string;
    parserName?: string;
    parserVersion?: string;
}

export interface IVendorComplianceOnFile {
    hipaaTrainingCompletedOn?: string;
    confidentialityAgreementSignedOn?: string;
    exclusionScreenedOn?: string;
    backgroundCheckClearedOn?: string;
}

export interface IVendorDetails {
    firstName?: string;
    lastName?: string;
    phone?: string;
    location?: { city?: string; state?: string; country?: string; timezone?: string };
    languages?: IVendorLanguageOnFile[];
    vehicle?: IVendorVehicleOnFile;
    availability?: { days?: string[]; hours?: string; shortNotice?: boolean; notes?: string };
    serviceModalities?: string[];
    documents?: Record<string, { status?: string; expiresOn?: string; note?: string }>;
    experience?: { years?: number; settings?: string[]; notes?: string };
    education?: Array<{ degree?: string; institution?: string; completedYear?: number }>;
    resume?: IVendorResumeOnFile;
    compliance?: IVendorComplianceOnFile;
    source?: { system?: string; reference?: string; appliedOn?: string };
    [key: string]: unknown;
}
