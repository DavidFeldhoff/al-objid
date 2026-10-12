az functionapp config appsettings set --resource-group al-obj-id-ninja   --name 4ps-al-obj-id-ninja-functionapp   --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false ENABLE_ORYX_BUILD=false WEBSITE_RUN_FROM_PACKAGE=1

az functionapp deployment source config-zip   --resource-group al-obj-id-ninja   --name 4ps-al-obj-id-ninja-functionapp   --src $zip


az functionapp config appsettings list --resource-group al-obj-id-ninja --name 4ps-al-obj-id-ninja-functionapp --query "[?name=='SCM_DO_BUILD_DURING_DEPLOYMENT' || name=='ENABLE_ORYX_BUILD' || name=='WEBSITE_RUN_FROM_PACKAGE'].[name,value]" -o table


az functionapp deploy --resource-group al-obj-id-ninja --name 4ps-al-obj-id-ninja-functionapp --src-path $zip --type zip