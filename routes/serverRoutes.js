import express from "express";
const router = express.Router();

import Site from '../controllers/site';
import auth from '../middlewares/auth';

import LeadRoute from "./leadRoutes";
import QuoteRoute from "./quoteRoutes";
import ContactRoute from "./contactRoutes"
import WalletRoutes from "./walletRoutes"
import NoteRoute from "./noteRoutes"
import CallRoute from "./callRoutes";
import MeetingRoute from "./meetingRoutes"
import EmailRoute from './EmailRoutes'
import TaskRoute from "./taskRoutes"
import UserRoute from "./userRoutes"
import PolicyRoute from "./policyRoutes"
import DocumentRoute from './documentRoutes'
import PolicyDocumentRoute from './policyDocumentRoutes'
import emailTemmplateRoute from './emailTemplateRoutes'
import DashboardRoute from './dashboardRoutes'
import CommonRoute from './commonRoutes'
import EmployeeRoutes from './employeeRoutes'
import AnalyticsRoutes from './analyticsRoutes'


router.use('/', CommonRoute);


router.get('/site-init', Site.index);
router.use('/lead', LeadRoute);
router.use('/quote', QuoteRoute);
router.use('/wallet', WalletRoutes);
// router.use('/contact', ContactRoute);
// router.use('/note', NoteRoute);
// router.use('/call', CallRoute)
// router.use('/meeting', MeetingRoute)
// router.use('/email', EmailRoute)
// router.use('/task', TaskRoute)
router.use('/user', UserRoute)
router.use('/policy', PolicyRoute)
router.use('/document', DocumentRoute)
router.use('/policydocument', PolicyDocumentRoute)
router.use('/emailtemplate', emailTemmplateRoute)
router.use('/admin', DashboardRoute);

router.use('/analytics', AnalyticsRoutes);

router.use('/employee', EmployeeRoutes);



router.get('/listAll', (req, res) => {
	
  const jsonResponse = {
    "success": true,
    "result": [
        {
            "_id": "65fdb27e29e5db1e1693236f",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "quote_settings",
            "settingKey": "quote_show_product_tax",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932371",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "quote_settings",
            "settingKey": "quote_status",
            "settingValue": [
                "draft",
                "pending",
                "sent",
                "negotiation",
                "accepted",
                "declined",
                "cancelled"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932376",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "offer_settings",
            "settingKey": "offer_pdf_footer",
            "settingValue": "Offer was created on a computer and is valid without the signature and seal",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693237a",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "currency_position",
            "settingValue": "before",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693237b",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "decimal_sep",
            "settingValue": ".",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693237f",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "lead_settings",
            "settingKey": "lead_type",
            "settingValue": [
                "person",
                "company"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693238b",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "invoice_settings",
            "settingKey": "invoice_status",
            "settingValue": [
                "draft",
                "pending",
                "sent",
                "received",
                "refund",
                "cancelled",
                "on hold"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693238d",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "inventory_settings",
            "settingKey": "order_number_length",
            "settingValue": 13,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693238e",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "inventory_settings",
            "settingKey": "order_number_type",
            "settingValue": "date_uniqueid",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693238f",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "inventory_settings",
            "settingKey": "product_number_type",
            "settingValue": "barcode",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932393",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "last_quote_number",
            "settingValue": 0,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932395",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "last_payment_number",
            "settingValue": 0,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932398",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "offer_prefix",
            "settingValue": "ofr-",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932399",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "payment_prefix",
            "settingValue": "pym-",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693239e",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_logo",
            "settingValue": "public/uploads/setting/company-logo.png",
            "valueType": "image",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693239f",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_icon",
            "settingValue": "public/uploads/setting/company-logo.png",
            "valueType": "image",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a4",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_phone",
            "settingValue": "+1 345234654",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323aa",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "client_type",
            "settingValue": [
                "people",
                "company"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323ab",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "client_status",
            "settingValue": [
                "active",
                "new",
                "premium",
                "unactive"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323ac",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "client_source",
            "settingValue": [
                "self checking",
                "sales lead",
                "recomendation",
                "facebook",
                "instagram",
                "tiktok",
                "youtube",
                "blog",
                "linkedin",
                "newsletter",
                "website",
                "twitter"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b5",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_timezone",
            "settingValue": "Asia/Calcutta",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932374",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "offer_settings",
            "settingKey": "offer_load_default_client",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932375",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "offer_settings",
            "settingKey": "offer_status",
            "settingValue": [
                "draft",
                "pending",
                "sent",
                "negotiation",
                "accepted",
                "declined",
                "cancelled"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693237c",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "thousand_sep",
            "settingValue": ",",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693237e",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "zero_format",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932391",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "inventory_settings",
            "settingKey": "generate_product_number",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932392",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "last_invoice_number",
            "settingValue": 0,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693239c",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "email_settings",
            "settingKey": "email_from",
            "settingValue": "IDURAR ERP CRM",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a0",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_address",
            "settingValue": "25 , Your Company Address",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a2",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_country",
            "settingValue": "United State",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a5",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_website",
            "settingValue": "www.example.com",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a9",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_bank_account",
            "settingValue": "iban : 00001231421",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323af",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "quote_default_client_type",
            "settingValue": "company",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b0",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "pos_default_client_type",
            "settingValue": "people",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b4",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_country",
            "settingValue": "IN",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b6",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_email",
            "settingValue": null,
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b9",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_industry",
            "settingValue": "default",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932372",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "quote_settings",
            "settingKey": "quote_pdf_footer",
            "settingValue": "Quote was created on a computer and is valid without the signature and seal",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932370",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "quote_settings",
            "settingKey": "quote_load_default_client",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932373",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "offer_settings",
            "settingKey": "offer_show_product_tax",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932378",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "currency_name",
            "settingValue": "US Dollars",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932383",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "lead_settings",
            "settingKey": "offer_default_lead_type",
            "settingValue": "company",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693238c",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "inventory_settings",
            "settingKey": "last_order_number",
            "settingValue": 0,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932394",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "last_offer_number",
            "settingValue": 0,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932396",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "invoice_prefix",
            "settingValue": "inv-",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932397",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "finance_settings",
            "settingKey": "quote_prefix",
            "settingValue": "qot-",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693239a",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "email_settings",
            "settingKey": "email_domain",
            "settingValue": "idurarapp.com",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a1",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_state",
            "settingValue": "New York",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a7",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_vat_number",
            "settingValue": "91231255234",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b1",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "pos_default_client",
            "settingValue": "609e0057246f2359b0c4c31f",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b2",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_date_format",
            "settingValue": "DD/MM/YYYY",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b7",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_company_email",
            "settingValue": "vij4yk@gmail.com",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323ba",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_early_access",
            "settingValue": "default",
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932377",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "default_currency_code",
            "settingValue": "USD",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932379",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "currency_symbol",
            "settingValue": "$",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693237d",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "money_format_settings",
            "settingKey": "cent_precision",
            "settingValue": 2,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932380",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "lead_settings",
            "settingKey": "lead_source",
            "settingValue": [
                "self checking",
                "sales lead",
                "recomendation",
                "facebook",
                "instagram",
                "tiktok",
                "youtube",
                "blog",
                "linkedin",
                "newsletter",
                "website",
                "twitter"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932381",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "lead_settings",
            "settingKey": "lead_status",
            "settingValue": [
                "draft",
                "new",
                "reached",
                "waiting",
                "in negosation",
                "won",
                "loose"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932382",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "lead_settings",
            "settingKey": "lead_category",
            "settingValue": [
                "Corporate",
                "person",
                "startup",
                "small company",
                "services business",
                "retails",
                "cafe & restaurant"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932388",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "invoice_settings",
            "settingKey": "invoice_show_product_tax",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932389",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "invoice_settings",
            "settingKey": "invoice_load_default_client",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693238a",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "invoice_settings",
            "settingKey": "invoice_pdf_footer",
            "settingValue": "Invoice was created on a computer and is valid without the signature and seal",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e16932390",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "inventory_settings",
            "settingKey": "last_product_number",
            "settingValue": 0,
            "valueType": "number",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693239b",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "email_settings",
            "settingKey": "email_reply_to",
            "settingValue": "reply@idurarapp.com",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e1693239d",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_name",
            "settingValue": "COMPANY Name",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a3",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_email",
            "settingValue": "youremail@example.com",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a6",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_tax_number",
            "settingValue": "91231255234",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323a8",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "company_settings",
            "settingKey": "company_reg_number",
            "settingValue": "00001231421",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323ad",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "client_category",
            "settingValue": [
                "Corporate",
                "startup",
                "small company",
                "services business",
                "retails",
                "cafe & restaurant"
            ],
            "valueType": "array",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323ae",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "client_settings",
            "settingKey": "invoice_default_client_type",
            "settingValue": "company",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b3",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_language",
            "settingValue": "en_us",
            "valueType": "string",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        },
        {
            "_id": "65fdb27e29e5db1e169323b8",
            "removed": false,
            "enabled": true,
            "account": "65fdb26429e5db1e16932362",
            "branch": "65fdb26429e5db1e16932364",
            "settingCategory": "app_settings",
            "settingKey": "idurar_app_has_mutli_branch",
            "settingValue": false,
            "valueType": "boolean",
            "isPrivate": false,
            "isCoreSetting": false,
            "__v": 0
        }
    ],
    "message": "Successfully found all documents"
};
  res.json(jsonResponse);
});



export default router;
