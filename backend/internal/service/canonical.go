package service

import (
	"regexp"
	"strings"
)

var canonicalMap = map[string]string{
	// Haemoglobin
	"hb":               "haemoglobin",
	"hgb":              "haemoglobin",
	"hemoglobin":       "haemoglobin",
	"haemoglobin":      "haemoglobin",
	"haemoglobin (hb)": "haemoglobin",

	// Blood Sugar
	"fbs":                   "fasting_blood_sugar",
	"fasting blood sugar":   "fasting_blood_sugar",
	"fasting glucose":       "fasting_blood_sugar",
	"blood glucose fasting": "fasting_blood_sugar",
	"rbs":                   "random_blood_sugar",
	"ppbs":                  "postprandial_blood_sugar",
	"hba1c":                 "hba1c",
	"glycated haemoglobin":  "hba1c",
	"glycosylated hemoglobin": "hba1c",

	// Thyroid
	"tsh":                        "tsh",
	"thyroid stimulating hormone": "tsh",
	"t3":                          "t3_total",
	"t4":                          "t4_total",
	"ft3":                         "t3_free",
	"ft4":                         "t4_free",

	// Lipid Profile
	"total cholesterol": "cholesterol_total",
	"cholesterol":       "cholesterol_total",
	"ldl":               "cholesterol_ldl",
	"ldl cholesterol":   "cholesterol_ldl",
	"hdl":               "cholesterol_hdl",
	"hdl cholesterol":   "cholesterol_hdl",
	"triglycerides":     "triglycerides",
	"tg":                "triglycerides",

	// Iron Studies
	"serum ferritin": "ferritin",
	"ferritin":       "ferritin",
	"serum iron":     "serum_iron",
	"tibc":           "tibc",

	// Liver
	"sgpt":                     "alt",
	"alt":                      "alt",
	"alanine aminotransferase": "alt",
	"sgot":                     "ast",
	"ast":                      "ast",
	"aspartate aminotransferase": "ast",

	// Kidney
	"serum creatinine":  "creatinine",
	"creatinine":        "creatinine",
	"blood urea nitrogen": "bun",
	"bun":               "bun",
	"urea":              "urea",

	// CBC
	"wbc":                  "wbc",
	"white blood cells":    "wbc",
	"total leucocyte count": "wbc",
	"tlc":                  "wbc",
	"rbc":                  "rbc",
	"red blood cells":      "rbc",
	"rbc count":            "rbc",
	"platelets":            "platelets",
	"platelet count":       "platelets",
	"plt":                  "platelets",

	// Vitamins
	"vitamin d":      "vitamin_d",
	"vitamin d3":     "vitamin_d",
	"25-oh vitamin d": "vitamin_d",
	"vitamin b12":    "vitamin_b12",
	"cyanocobalamin": "vitamin_b12",
}

var nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9]+`)

func NormalizeCanonicalName(rawName string) string {
	key := strings.TrimSpace(strings.ToLower(rawName))
	
	if canonical, ok := canonicalMap[key]; ok {
		return canonical
	}
	
	return toSnakeCase(rawName)
}

func toSnakeCase(input string) string {
	s := strings.TrimSpace(strings.ToLower(input))
	s = nonAlphanumericRegex.ReplaceAllString(s, "_")
	s = strings.Trim(s, "_")
	return s
}

func CanonicalToDisplayName(canonical string) string {
	parts := strings.Split(canonical, "_")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(string(part[0])) + part[1:]
		}
	}
	return strings.Join(parts, " ")
}

func ComputeIsFlagged(value float64, referenceLow, referenceHigh *float64) bool {
	if referenceLow != nil && value < *referenceLow {
		return true
	}
	if referenceHigh != nil && value > *referenceHigh {
		return true
	}
	return false
}
