package handler

import (
	"encoding/json"
	"net/http"
)

type ErrorResponse struct {
	Error string `json:"error"`
}

// CodedErrorResponse is used when clients need a stable machine-readable code (e.g. upload limits).
type CodedErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, ErrorResponse{Error: message})
}

func respondCodedError(w http.ResponseWriter, status int, message, code string) {
	respondJSON(w, status, CodedErrorResponse{Error: message, Code: code})
}
