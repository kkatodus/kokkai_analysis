from selenium import webdriver
#parameters
output_dir = "..\\..\\data_sangiin\\"
chromedriver_path = "..\\chromedriver.exe"
main_website_url = "https://xn--hhr797a3hrxtn.com/house-of-councillors/"
    


def sangiin_collect():
    driver = webdriver.Chrome(executable_path = chromedriver_path)
    driver.get(main_website_url)
    pass

if __name__ == "__main__":
    set_params()
    sangiin_collect()